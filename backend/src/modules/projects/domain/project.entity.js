function toProjectDto(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    katalon_project_path: row.katalon_project_path,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

module.exports = {
  toProjectDto
};
