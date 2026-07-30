const mysql = require('mysql2/promise');

async function clear() {
  const db = await mysql.createConnection({
    host: '127.0.0.1', port: 3306,
    user: 'root', password: '',
    database: 'mpoa_db',
  });

  const [[{ companies }]] = await db.query(
    `SELECT COUNT(*) AS companies FROM COMPANY WHERE branch = 'MPOASSB'`
  );
  console.log(`Found ${companies} MPOASSB company record(s) to delete.`);

  await db.query(`
    DELETE ct FROM CONTACT ct
    JOIN ENTITY e  ON ct.entity_id  = e.entity_id
    JOIN COMPANY c ON e.company_id  = c.company_id
    WHERE c.branch = 'MPOASSB'
  `);
  console.log('✓ CONTACT rows deleted');

  await db.query(`
    DELETE s FROM ANNUAL_STATS s
    JOIN ENTITY e  ON s.entity_id  = e.entity_id
    JOIN COMPANY c ON e.company_id = c.company_id
    WHERE c.branch = 'MPOASSB'
  `);
  console.log('✓ ANNUAL_STATS rows deleted');

  await db.query(`
    DELETE e FROM ENTITY e
    JOIN COMPANY c ON e.company_id = c.company_id
    WHERE c.branch = 'MPOASSB'
  `);
  console.log('✓ ENTITY rows deleted');

  const [{ affectedRows }] = await db.query(
    `DELETE FROM COMPANY WHERE branch = 'MPOASSB'`
  );
  console.log(`✓ COMPANY rows deleted: ${affectedRows}`);

  await db.end();
  console.log('\nAll MPOASSB data cleared. You can now re-upload your CSV/XLSX file.');
}

clear().catch(err => { console.error(err); process.exit(1); });
