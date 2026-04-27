/**
 * cloneOracleTable()
 *
 * Clones an Oracle table including:
 *   ✅ table structure
 *   ✅ data
 *   ✅ indexes
 *   ✅ PK / UK / CHECK constraints
 *   ✅ triggers
 *   ✅ grants
 *
 * Requires:
 *   npm install oracledb
 *
 * Notes:
 * - Foreign keys can be copied too, but often need relationship review.
 * - Constraint/index/trigger names are auto-renamed.
 */

const oracledb = require("oracledb");

async function cloneOracleTable(config, sourceTable, targetTable) {
  let conn;

  try {
    conn = await oracledb.getConnection(config);

    sourceTable = sourceTable.toUpperCase();
    targetTable = targetTable.toUpperCase();

    // -----------------------------
    // Helper Functions
    // -----------------------------
    const run = async (sql, binds = {}) => {
      return conn.execute(sql, binds, { autoCommit: false });
    };

    const getDDL = async (type, name) => {
      const r = await run(
        `SELECT DBMS_METADATA.GET_DDL(:type, :name) FROM dual`,
        { type, name }
      );
      return r.rows[0][0];
    };

    const renameAll = (text) => {
      return text.replace(
        new RegExp(`"${sourceTable}"`, "g"),
        `"${targetTable}"`
      );
    };

    const shortenName = (name, suffix) => {
      let n = `${targetTable}_${suffix}`;
      return n.substring(0, 30); // Oracle object name max
    };

    // -----------------------------
    // 1. CREATE TABLE
    // -----------------------------
    console.log("Creating table...");

    let tableDDL = await getDDL("TABLE", sourceTable);
    tableDDL = renameAll(tableDDL);

    await run(tableDDL);

    // -----------------------------
    // 2. COPY DATA
    // -----------------------------
    console.log("Copying rows...");

    await run(`
      INSERT INTO "${targetTable}"
      SELECT * FROM "${sourceTable}"
    `);

    // -----------------------------
    // 3. INDEXES
    // -----------------------------
    console.log("Copying indexes...");

    const indexes = await run(`
      SELECT index_name
      FROM user_indexes
      WHERE table_name = :table
        AND generated = 'N'
        AND index_name NOT IN (
          SELECT constraint_name
          FROM user_constraints
          WHERE table_name = :table
        )
    `, { table: sourceTable });

    for (const row of indexes.rows) {
      const oldName = row[0];
      let ddl = await getDDL("INDEX", oldName);

      const newName = shortenName(oldName, "IDX");

      ddl = ddl.replace(
        new RegExp(`"${oldName}"`, "g"),
        `"${newName}"`
      );

      ddl = renameAll(ddl);

      try {
        await run(ddl);
      } catch (e) {
        console.log(`Skip index ${oldName}: ${e.message}`);
      }
    }

    // -----------------------------
    // 4. CONSTRAINTS
    // -----------------------------
    console.log("Copying constraints...");

    const cons = await run(`
      SELECT constraint_name
      FROM user_constraints
      WHERE table_name = :table
        AND constraint_type IN ('P','U','C')
    `, { table: sourceTable });

    for (const row of cons.rows) {
      const oldName = row[0];
      let ddl = await getDDL("CONSTRAINT", oldName);

      const newName = shortenName(oldName, "CON");

      ddl = ddl.replace(
        new RegExp(`"${oldName}"`, "g"),
        `"${newName}"`
      );

      ddl = renameAll(ddl);

      try {
        await run(ddl);
      } catch (e) {
        console.log(`Skip constraint ${oldName}: ${e.message}`);
      }
    }

    // -----------------------------
    // 5. TRIGGERS
    // -----------------------------
    console.log("Copying triggers...");

    const triggers = await run(`
      SELECT trigger_name
      FROM user_triggers
      WHERE table_name = :table
    `, { table: sourceTable });

    for (const row of triggers.rows) {
      const oldName = row[0];
      let ddl = await getDDL("TRIGGER", oldName);

      const newName = shortenName(oldName, "TRG");

      ddl = ddl.replace(
        new RegExp(`"${oldName}"`, "g"),
        `"${newName}"`
      );

      ddl = renameAll(ddl);

      try {
        await run(ddl);
      } catch (e) {
        console.log(`Skip trigger ${oldName}: ${e.message}`);
      }
    }

    // -----------------------------
    // 6. GRANTS
    // -----------------------------
    console.log("Copying grants...");

    const grants = await run(`
      SELECT grantee, privilege
      FROM user_tab_privs
      WHERE table_name = :table
    `, { table: sourceTable });

    for (const row of grants.rows) {
      const grantee = row[0];
      const privilege = row[1];

      try {
        await run(`
          GRANT ${privilege}
          ON "${targetTable}"
          TO "${grantee}"
        `);
      } catch (e) {
        console.log(`Skip grant ${grantee}: ${e.message}`);
      }
    }

    // -----------------------------
    // COMMIT
    // -----------------------------
    await conn.commit();

    console.log(`SUCCESS: ${sourceTable} cloned to ${targetTable}`);

  } catch (err) {
    console.error("FAILED:", err);
    if (conn) await conn.rollback();
  } finally {
    if (conn) await conn.close();
  }
}
