const { randomUUID } = require('crypto');

const { pool, query } = require('../../../config/database');

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

async function listTestCasesByProject(projectId) {
  const result = await query(
    `SELECT tc.id,
            tc.project_id,
            tc.name,
            tc.description,
            tc.expected_result,
            tc.script_content AS script,
            tc.target_url AS url,
            tc.created_at,
            tc.updated_at,
            COUNT(stcl.id)::int AS linked_suite_count
       FROM test_cases tc
  LEFT JOIN suite_test_case_links stcl ON stcl.test_case_id = tc.id
      WHERE tc.project_id = $1
   GROUP BY tc.id
   ORDER BY tc.updated_at DESC`,
    [projectId]
  );

  return result.rows;
}

function buildStepTree(stepRows) {
  const map = new Map();
  const roots = [];

  stepRows.forEach((row) => {
    map.set(row.id, {
      id: row.id,
      test_case_id: row.test_case_id,
      parent_step_id: row.parent_step_id,
      title: row.title,
      description: row.description,
      expected_result: row.expected_result,
      step_order: row.step_order,
      created_at: row.created_at,
      updated_at: row.updated_at,
      children: []
    });
  });

  map.forEach((node) => {
    if (!node.parent_step_id) {
      roots.push(node);
      return;
    }

    const parent = map.get(node.parent_step_id);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  function sortNodes(nodes) {
    nodes.sort((a, b) => a.step_order - b.step_order);
    nodes.forEach((node) => sortNodes(node.children));
  }

  sortNodes(roots);
  return roots;
}

async function getTestCaseById(projectId, testCaseId) {
  const testCaseResult = await query(
    `SELECT id,
            project_id,
            name,
            description,
            expected_result,
            script_content AS script,
            target_url AS url,
            scanned_dom_json,
            created_at,
            updated_at
       FROM test_cases
      WHERE id = $1 AND project_id = $2
      LIMIT 1`,
    [testCaseId, projectId]
  );

  if (testCaseResult.rowCount === 0) {
    return null;
  }

  const stepResult = await query(
    `SELECT id, test_case_id, parent_step_id, title, description, expected_result, step_order, created_at, updated_at
       FROM test_case_steps
      WHERE test_case_id = $1
   ORDER BY parent_step_id NULLS FIRST, step_order ASC, created_at ASC`,
    [testCaseId]
  );

  const dataSetResult = await query(
    `SELECT id, test_case_id, name, data_json, created_at, updated_at
       FROM test_case_data_sets
      WHERE test_case_id = $1
   ORDER BY created_at ASC`,
    [testCaseId]
  );

  const suiteLinkResult = await query(
    `SELECT stcl.id,
            stcl.suite_id,
            stcl.execution_order,
            stcl.created_at,
            stcl.updated_at,
            ts.name AS suite_name
       FROM suite_test_case_links stcl
       JOIN test_suites ts ON ts.id = stcl.suite_id
      WHERE stcl.test_case_id = $1
   ORDER BY ts.name ASC, stcl.execution_order ASC`,
    [testCaseId]
  );

  return {
    ...testCaseResult.rows[0],
    steps: buildStepTree(stepResult.rows),
    data_sets: dataSetResult.rows,
    linked_suites: suiteLinkResult.rows
  };
}

async function insertStepsRecursive(client, testCaseId, steps, parentStepId = null) {
  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    const stepId = randomUUID();
    await client.query(
      `INSERT INTO test_case_steps (id, test_case_id, parent_step_id, title, description, expected_result, step_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        stepId,
        testCaseId,
        parentStepId,
        step.title,
        step.description || null,
        step.expected_result || null,
        index + 1
      ]
    );

    if (Array.isArray(step.children) && step.children.length > 0) {
      await insertStepsRecursive(client, testCaseId, step.children, stepId);
    }
  }
}

async function replaceTestCaseSteps(client, testCaseId, steps) {
  await client.query('DELETE FROM test_case_steps WHERE test_case_id = $1', [testCaseId]);
  if (Array.isArray(steps) && steps.length > 0) {
    await insertStepsRecursive(client, testCaseId, steps);
  }
}

async function replaceTestCaseDataSets(client, testCaseId, dataSets) {
  await client.query('DELETE FROM test_case_data_sets WHERE test_case_id = $1', [testCaseId]);
  for (let index = 0; index < dataSets.length; index += 1) {
    const dataSet = dataSets[index];
    await client.query(
      `INSERT INTO test_case_data_sets (id, test_case_id, name, data_json)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [randomUUID(), testCaseId, dataSet.name, JSON.stringify(dataSet.data_json)]
    );
  }
}

async function createTestCase(projectId, payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const testCaseId = randomUUID();
    await client.query(
      `INSERT INTO test_cases (id, project_id, name, description, expected_result, script_content, target_url, scanned_dom_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        testCaseId,
        projectId,
        payload.name,
        payload.description || null,
        payload.expected_result || null,
        payload.script || null,
        payload.url || null,
        payload.scanned_dom_json ? JSON.stringify(payload.scanned_dom_json) : null,
      ]
    );

    await replaceTestCaseSteps(client, testCaseId, payload.steps || []);
    await replaceTestCaseDataSets(client, testCaseId, payload.data_sets || []);

    await client.query('COMMIT');
    return getTestCaseById(projectId, testCaseId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateTestCase(projectId, testCaseId, payload) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

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
        payload.url || null
      ]
    );

    if (updateResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    await replaceTestCaseSteps(client, testCaseId, payload.steps || []);
    await replaceTestCaseDataSets(client, testCaseId, payload.data_sets || []);

    await client.query('COMMIT');
    return getTestCaseById(projectId, testCaseId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteTestCase(projectId, testCaseId) {
  const result = await query('DELETE FROM test_cases WHERE id = $1 AND project_id = $2', [testCaseId, projectId]);
  return result.rowCount > 0;
}

module.exports = {
  projectExists,
  getProjectPath,
  listTestCasesByProject,
  getTestCaseById,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  // Shared helpers — used by testSuite.repository.pg to keep both paths in sync
  insertStepsRecursive,
  replaceTestCaseSteps,
  replaceTestCaseDataSets,
};
