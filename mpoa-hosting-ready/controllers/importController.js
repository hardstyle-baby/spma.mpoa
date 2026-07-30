const XLSX      = require('xlsx');
const { sequelize, Company, Entity, Contact, AnnualStats, StatAudit, ImportLog } = require('../models');
const {
  normalizePhone,
  normalizeYear,
  normalizeNumber,
  normalizeDate,
  normalizeString,
  splitContacts,
} = require('../utils/excelNormalizer');

// ── Expected column headers (case-insensitive) ───────────────
const COL = {
  COMPANY_NAME:    'company_name',
  REG_NO:          'registration_no',
  EST_DATE:        'est_date',
  ADDRESS:         'address',
  STATE:           'state',
  POSTCODE:        'postcode',
  ENTITY_TYPE:     'entity_type',
  ENTITY_NAME:     'entity_name',
  LICENSE_NO:      'license_no',
  LOCATION:        'location',
  CAPACITY_MT:     'capacity_mt',
  CONTACT_NAME:    'contact_name',
  CONTACT_PHONE:   'contact_phone',
  CONTACT_EMAIL:   'contact_email',
  STAT_YEAR:       'stat_year',
  PLANTED_HA:      'planted_ha',
  MATURE_HA:       'mature_ha',
  FFB_PRODUCTION:  'ffb_production',
  CPO_PRODUCTION:  'cpo_production',
  PK_PRODUCTION:   'pk_production',
};

// Normalise header row keys
const normalizeHeaders = (row) => {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.trim().toLowerCase().replace(/\s+/g, '_')] = v;
  }
  return out;
};

// ── POST /api/import ─────────────────────────────────────────
const importExcel = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const isDryRun  = req.query.dry_run === 'true';
  const branch    = req.user.branch;
  const importedBy = req.user.user_id;

  let workbook;
  try {
    workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: false });
  } catch {
    return res.status(400).json({ message: 'Invalid Excel file.' });
  }

  const sheetName = workbook.SheetNames[0];
  const rawRows   = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  const errors       = [];
  let successCount   = 0;
  const totalRows    = rawRows.length;

  const t = isDryRun ? null : await sequelize.transaction();

  try {
    for (let i = 0; i < rawRows.length; i++) {
      const rowNum = i + 2; // 1-indexed + header
      const raw    = normalizeHeaders(rawRows[i]);

      // ── Required fields ──────────────────────────────────────
      const companyName = normalizeString(raw[COL.COMPANY_NAME]);
      if (!companyName) {
        errors.push({ row: rowNum, message: 'company_name is required.' });
        continue;
      }

      const entityType = normalizeString(raw[COL.ENTITY_TYPE])?.toUpperCase();
      if (!['POM', 'POR'].includes(entityType)) {
        errors.push({ row: rowNum, message: `entity_type must be POM or POR (got: ${raw[COL.ENTITY_TYPE]}).` });
        continue;
      }

      const entityName = normalizeString(raw[COL.ENTITY_NAME]);
      if (!entityName) {
        errors.push({ row: rowNum, message: 'entity_name is required.' });
        continue;
      }

      try {
        if (!isDryRun) {
          // ── Upsert Company ──────────────────────────────────
          const [company] = await Company.findOrCreate({
            where:    { company_name: companyName, branch },
            defaults: {
              registration_no: normalizeString(raw[COL.REG_NO], 100),
              est_date:        normalizeYear(raw[COL.EST_DATE]),
              branch,
              address:         normalizeString(raw[COL.ADDRESS], 500),
              state:           normalizeString(raw[COL.STATE], 100),
              postcode:        normalizeString(raw[COL.POSTCODE], 10),
            },
            transaction: t,
          });

          // ── Upsert Entity ───────────────────────────────────
          const [entity] = await Entity.findOrCreate({
            where:    { company_id: company.company_id, entity_name: entityName },
            defaults: {
              entity_type:  entityType,
              license_no:   normalizeString(raw[COL.LICENSE_NO], 100),
              location:     normalizeString(raw[COL.LOCATION]),
              state:        normalizeString(raw[COL.STATE], 100),
              capacity_mt:  normalizeNumber(raw[COL.CAPACITY_MT]),
            },
            transaction: t,
          });

          // ── Contacts (slash-split) ──────────────────────────
          const names  = splitContacts(raw[COL.CONTACT_NAME]);
          const phones = splitContacts(raw[COL.CONTACT_PHONE]);
          const emails = splitContacts(raw[COL.CONTACT_EMAIL]);

          for (let ci = 0; ci < names.length; ci++) {
            const name = names[ci];
            if (!name) continue;
            await Contact.findOrCreate({
              where:    { entity_id: entity.entity_id, contact_name: name },
              defaults: {
                phone:      normalizePhone(phones[ci]),
                email:      normalizeString(emails[ci], 255),
                is_primary: ci === 0 ? 1 : 0,
              },
              transaction: t,
            });
          }

          // ── Annual Stats ────────────────────────────────────
          const statYear = normalizeYear(raw[COL.STAT_YEAR]);
          if (statYear) {
            const statValues = {
              planted_ha:     normalizeNumber(raw[COL.PLANTED_HA]),
              mature_ha:      normalizeNumber(raw[COL.MATURE_HA]),
              ffb_production: normalizeNumber(raw[COL.FFB_PRODUCTION]),
              cpo_production: normalizeNumber(raw[COL.CPO_PRODUCTION]),
              pk_production:  normalizeNumber(raw[COL.PK_PRODUCTION]),
            };

            const [, statCreated] = await AnnualStats.findOrCreate({
              where:    { entity_id: entity.entity_id, stat_year: statYear },
              defaults: statValues,
              transaction: t,
            });

            // Insert-only import: log ONLY brand-new year rows to the audit
            // trail. Existing years are left untouched and not re-logged.
            if (statCreated) {
              const STAT_LABELS = {
                planted_ha:     'Planted HA',
                mature_ha:      'Mature HA',
                ffb_production: 'FFB Production',
                cpo_production: 'CPO Production',
                pk_production:  'PK Production',
              };
              const auditRows = [];
              for (const [field, label] of Object.entries(STAT_LABELS)) {
                const val = statValues[field];
                if (val !== null && val !== undefined && String(val).trim() !== '') {
                  auditRows.push({
                    entity_id:       entity.entity_id,
                    stat_year:       statYear,
                    field_name:      field,
                    field_label:     label,
                    old_value:       null,
                    new_value:       String(val),
                    action:          'create',
                    changed_by:      importedBy || null,
                    changed_by_name: req.user.username ? `${req.user.username} (import)` : 'import',
                  });
                }
              }
              if (auditRows.length) await StatAudit.bulkCreate(auditRows, { transaction: t });
            }
          }
        }

        successCount++;
      } catch (rowErr) {
        errors.push({ row: rowNum, message: rowErr.message });
      }
    }

    if (!isDryRun) {
      await t.commit();
    }

    // ── Log the import ────────────────────────────────────────
    await ImportLog.create({
      filename:      req.file.originalname,
      branch,
      imported_by:   importedBy,
      is_dry_run:    isDryRun ? 1 : 0,
      total_rows:    totalRows,
      success_count: successCount,
      error_count:   errors.length,
      errors:        errors.length ? errors : null,
    });

    return res.json({
      dry_run:       isDryRun,
      total_rows:    totalRows,
      success_count: successCount,
      error_count:   errors.length,
      errors,
    });
  } catch (err) {
    if (!isDryRun && t) await t.rollback();
    console.error('[import]', err);
    return res.status(500).json({ message: 'Import failed.', error: err.message });
  }
};

// ── GET /api/import/template ──────────────────────────────────
// Returns a downloadable Excel template with correct column headers
const downloadTemplate = (req, res) => {
  const headers = [
    {
      company_name:   'Syarikat Contoh Sdn Bhd',
      registration_no: '123456-X',
      est_date:       2000,
      address:        'No 1, Jalan Contoh',
      state:          'Selangor',
      postcode:       '41000',
      entity_type:    'POM',
      entity_name:    'Kilang Sawit Contoh',
      license_no:     'L-001',
      location:       'Kuala Langat',
      capacity_mt:    60,
      contact_name:   'Ahmad / Budi',
      contact_phone:  '0123456789 / 0187654321',
      contact_email:  'ahmad@contoh.com',
      stat_year:      2023,
      planted_ha:     1000,
      mature_ha:      900,
      ffb_production: 15000,
      cpo_production: 3000,
      pk_production:  750,
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(headers);
  XLSX.utils.book_append_sheet(wb, ws, 'Members');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename=mpoa_import_template.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(buf);
};

// ── GET /api/import/export ────────────────────────────────────
// Export all members of the current branch as Excel
const exportMembers = async (req, res) => {
  try {
    const companies = await Company.findAll({
      where:   { branch: req.user.branch, is_active: 1 },
      include: [
        {
          model:   Entity,
          as:      'entities',
          include: [
            { model: Contact,     as: 'contacts'    },
            { model: AnnualStats, as: 'annualStats' },
          ],
        },
      ],
    });

    const rows = [];
    for (const co of companies) {
      for (const en of co.entities) {
        const contacts = en.contacts || [];
        const stats    = en.annualStats || [];

        const baseRow = {
          company_name:    co.company_name,
          registration_no: co.registration_no,
          est_date:        co.est_date,
          state:           co.state,
          entity_type:     en.entity_type,
          entity_name:     en.entity_name,
          license_no:      en.license_no,
          location:        en.location,
          capacity_mt:     en.capacity_mt,
          contact_name:    contacts.map((c) => c.contact_name).join(' / '),
          contact_phone:   contacts.map((c) => c.phone).join(' / '),
          contact_email:   contacts.map((c) => c.email).join(' / '),
        };

        if (stats.length === 0) {
          rows.push(baseRow);
        } else {
          for (const s of stats) {
            rows.push({
              ...baseRow,
              stat_year:      s.stat_year,
              planted_ha:     s.planted_ha,
              mature_ha:      s.mature_ha,
              ffb_production: s.ffb_production,
              cpo_production: s.cpo_production,
              pk_production:  s.pk_production,
            });
          }
        }
      }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Members');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const filename = `${req.user.branch}_members_${Date.now()}.xlsx`;

    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buf);
  } catch (err) {
    console.error('[export]', err);
    return res.status(500).json({ message: 'Export failed.' });
  }
};

module.exports = { importExcel, downloadTemplate, exportMembers };
