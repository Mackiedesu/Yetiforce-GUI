const { randomUUID } = require('crypto');

const { pool, query } = require('../../../config/database');
const {
  replaceTestCaseSteps,
  replaceTestCaseDataSets,
} = require('../../test-cases/infrastructure/testCase.repository.pg');

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

async function projectExists(projectId) {
  const result = await query('SELECT 1 FROM projects WHERE id = $1 LIMIT 1', [projectId]);
  return result.rowCount > 0;
}

async function getProjectPath(projectId) {
  const result = await query(
    'SELECT katalon_project_path FROM projects WHERE id = $1 LIMIT 1',
    [projectId]
  );
  return result.rows[0]?.katalon_project_path || null;
}

async function suiteExists(client, projectId, suiteId) {
  const result = await client.query('SELECT id FROM test_suites WHERE id = $1 AND project_id = $2 LIMIT 1', [suiteId, projectId]);
  return result.rowCount > 0;
}

async function ensureTestCaseBelongsToProject(client, projectId, testCaseId) {
  const result = await client.query('SELECT id FROM test_cases WHERE id = $1 AND project_id = $2 LIMIT 1', [testCaseId, projectId]);
  return result.rowCount > 0;
}

async function createReusableTestCase(client, projectId, payload) {
  const testCaseId = randomUUID();
  await client.query(
    `INSERT INTO test_cases (id, project_id, name, description, expected_result, script_content, target_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      testCaseId,
      projectId,
      payload.name,
      payload.description || null,
      payload.expected_result || null,
      payload.script || null,
      payload.url || null,
    ]
  );
  await replaceTestCaseSteps(client, testCaseId, payload.steps || []);
  await replaceTestCaseDataSets(client, testCaseId, payload.data_sets || []);
  return testCaseId;
}

async function getNextExecutionOrder(client, suiteId) {
  const maxOrderResult = await client.query(
    'SELECT COALESCE(MAX(execution_order), 0)::int AS max_order FROM suite_test_case_links WHERE suite_id = $1',
    [suiteId]
  );
  return maxOrderResult.rows[0].max_order + 1;
}

async function linkTestCaseToSuite(client, suiteId, testCaseId, executionOrder = null) {
  const nextOrder = executionOrder || (await getNextExecutionOrder(client, suiteId));
  await client.query(
    `INSERT INTO suite_test_case_links (id, suite_id, test_case_id, execution_order)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), suiteId, testCaseId, nextOrder]
  );
}

async function listSuitesByProject(projectId) {
  const result = await query(
    `SELECT ts.id,
            ts.project_id,
            ts.name,
            ts.description,
            ts.created_at,
            ts.updated_at,
            COUNT(stcl.id)::int AS test_case_count
       FROM test_suites ts
  LEFT JOIN suite_test_case_links stcl ON stcl.suite_id = ts.id
      WHERE ts.project_id = $1
   GROUP BY ts.id
   ORDER BY ts.created_at DESC`,
    [projectId]
  );

  return result.rows;
}

async function getSuiteById(projectId, suiteId) {
  const suiteResult = await query(
    `SELECT id, project_id, name, description, created_at, updated_at
       FROM test_suites
      WHERE id = $1 AND project_id = $2
      LIMIT 1`,
    [suiteId, projectId]
  );

  if (suiteResult.rowCount === 0) {
    return null;
  }

  const testCasesResult = await query(
    `SELECT tc.id,
            stcl.id AS suite_link_id,
            stcl.suite_id,
            stcl.execution_order,
            tc.name,
            tc.description,
            tc.expected_result,
            tc.script_content AS script,
            tc.target_url AS url,
            tc.created_at,
            tc.updated_at
       FROM suite_test_case_links stcl
       JOIN test_cases tc ON tc.id = stcl.test_case_id
      WHERE stcl.suite_id = $1
   ORDER BY stcl.execution_order ASC`,
    [suiteId]
  );

  return {
    ...suiteResult.rows[0],
    test_cases: testCasesResult.rows
  };
}

async function createSuite(projectId, payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const suiteId = randomUUID();
    await client.query(
      `INSERT INTO test_suites (id, project_id, name, description)
       VALUES ($1, $2, $3, $4)`,
      [suiteId, projectId, payload.name, payload.description || null]
    );

    const testCases = payload.test_cases || [];
    for (let index = 0; index < testCases.length; index += 1) {
      const testCase = testCases[index];
      let testCaseId = testCase.test_case_id;
      if (testCaseId) {
        const belongsToProject = await ensureTestCaseBelongsToProject(client, projectId, testCaseId);
        if (!belongsToProject) {
          throw createValidationError('Test case không thuộc project này');
        }
      } else {
        testCaseId = await createReusableTestCase(client, projectId, testCase);
      }

      await linkTestCaseToSuite(client, suiteId, testCaseId, index + 1);
    }

    await client.query('COMMIT');
    return getSuiteById(projectId, suiteId);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      throw createValidationError('Danh sách test case của suite bị trùng');
    }
    throw error;
  } finally {
    client.release();
  }
}

async function updateSuite(projectId, suiteId, payload) {
  const result = await query(
    `UPDATE test_suites
        SET name = $3,
            description = $4,
            updated_at = NOW()
      WHERE id = $1 AND project_id = $2
      RETURNING id`,
    [suiteId, projectId, payload.name, payload.description || null]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return getSuiteById(projectId, suiteId);
}

async function deleteSuite(projectId, suiteId) {
  const result = await query('DELETE FROM test_suites WHERE id = $1 AND project_id = $2', [suiteId, projectId]);
  return result.rowCount > 0;
}

async function addTestCase(projectId, suiteId, payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const suiteInProject = await suiteExists(client, projectId, suiteId);
    if (!suiteInProject) {
      await client.query('ROLLBACK');
      return null;
    }

    let testCaseId = payload.test_case_id;
    if (testCaseId) {
      const belongsToProject = await ensureTestCaseBelongsToProject(client, projectId, testCaseId);
      if (!belongsToProject) {
        throw createValidationError('Test case không thuộc project này');
      }
    } else {
      testCaseId = await createReusableTestCase(client, projectId, payload);
    }

    await linkTestCaseToSuite(client, suiteId, testCaseId);

    await client.query('COMMIT');
    return getSuiteById(projectId, suiteId);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      throw createValidationError('Test case đã tồn tại trong suite này');
    }
    throw error;
  } finally {
    client.release();
  }
}

async function updateTestCase(projectId, suiteId, testCaseId, payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const suiteInProject = await suiteExists(client, projectId, suiteId);
    if (!suiteInProject) {
      await client.query('ROLLBACK');
      return null;
    }

    const linkResult = await client.query(
      'SELECT id FROM suite_test_case_links WHERE suite_id = $1 AND test_case_id = $2 LIMIT 1',
      [suiteId, testCaseId]
    );
    if (linkResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    if (payload.test_case_id && payload.test_case_id !== testCaseId) {
      const belongsToProject = await ensureTestCaseBelongsToProject(client, projectId, payload.test_case_id);
      if (!belongsToProject) {
        throw createValidationError('Test case không thuộc project này');
      }

      await client.query(
        `UPDATE suite_test_case_links
            SET test_case_id = $3,
                updated_at = NOW()
          WHERE suite_id = $1 AND test_case_id = $2`,
        [suiteId, testCaseId, payload.test_case_id]
      );
    } else {
      const updateResult = await client.query(
        `UPDATE test_cases
            SET name = $3,
                description = $4,
                expected_result = $5,
                script_content = $6,
                target_url = $7,
                updated_at = NOW()
          WHERE id = $1 AND project_id = $2
          RETURNING id`,
        [
          testCaseId,
          projectId,
          payload.name,
          payload.description || null,
          payload.expected_result || null,
          payload.script || null,
          payload.url || null,
        ]
      );
      if (updateResult.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }
      await replaceTestCaseSteps(client, testCaseId, payload.steps || []);
      await replaceTestCaseDataSets(client, testCaseId, payload.data_sets || []);
    }

    await client.query('COMMIT');
    return getSuiteById(projectId, suiteId);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      throw createValidationError('Test case đã tồn tại trong suite này');
    }
    throw error;
  } finally {
    client.release();
  }
}

async function deleteTestCase(projectId, suiteId, testCaseId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const suiteInProject = await suiteExists(client, projectId, suiteId);
    if (!suiteInProject) {
      await client.query('ROLLBACK');
      return null;
    }

    const deleteResult = await client.query(
      'DELETE FROM suite_test_case_links WHERE suite_id = $1 AND test_case_id = $2 RETURNING id',
      [suiteId, testCaseId]
    );

    if (deleteResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    const remainResult = await client.query(
      'SELECT id FROM suite_test_case_links WHERE suite_id = $1 ORDER BY execution_order ASC',
      [suiteId]
    );

    for (let index = 0; index < remainResult.rows.length; index += 1) {
      await client.query(
        'UPDATE suite_test_case_links SET execution_order = $2, updated_at = NOW() WHERE id = $1',
        [remainResult.rows[index].id, index + 1]
      );
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function reorderTestCases(projectId, suiteId, orderItems) {
  const suite = await getSuiteById(projectId, suiteId);
  if (!suite) {
    return null;
  }

  const idsInDb = suite.test_cases.map((item) => item.id).sort();
  const idsIncoming = orderItems.map((item) => item.id).sort();
  if (idsInDb.length !== idsIncoming.length || idsInDb.join(',') !== idsIncoming.join(',')) {
    throw createValidationError('Danh sách test case reorder không hợp lệ');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      'UPDATE suite_test_case_links SET execution_order = execution_order + 100000, updated_at = NOW() WHERE suite_id = $1',
      [suiteId]
    );

    for (let index = 0; index < orderItems.length; index += 1) {
      const item = orderItems[index];
      await client.query(
        'UPDATE suite_test_case_links SET execution_order = $3, updated_at = NOW() WHERE suite_id = $1 AND test_case_id = $2',
        [suiteId, item.id, index + 1]
      );
    }

    await client.query('COMMIT');
    return getSuiteById(projectId, suiteId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  projectExists,
  getProjectPath,
  listSuitesByProject,
  getSuiteById,
  createSuite,
  updateSuite,
  deleteSuite,
  addTestCase,
  updateTestCase,
  deleteTestCase,
  reorderTestCases
};
