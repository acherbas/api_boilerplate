const { getConnection } = require('../db');
const { sendMail } = require('../mailer');

async function validateAccounts() {
  let conn;

  try {
    conn = await getConnection();

    const result = await conn.execute(`
      SELECT ID, EMAIL, VALID_UNTIL
      FROM USERS
      WHERE VALID_UNTIL < SYSDATE
        AND STATUS = 'ACTIVE'
    `);

    for (const row of result.rows) {
      const id = row[0];
      const email = row[1];

      await sendMail(
        email,
        'Account Validation Expired',
        'Your account validation has expired. Please renew.'
      );

      await conn.execute(
        `UPDATE USERS
         SET STATUS = 'EXPIRED'
         WHERE ID = :id`,
        { id },
        { autoCommit: true }
      );
    }

    console.log(`Processed ${result.rows.length} expired accounts`);

  } catch (err) {
    console.error(err);
  } finally {
    if (conn) await conn.close();
  }
}

module.exports = { validateAccounts };
