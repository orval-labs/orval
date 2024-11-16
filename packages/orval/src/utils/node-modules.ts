import findUp from "find-up";

export const getNodeModulesPath = async (workspace: string) => {
  return await findUp(['node_modules'], {
    cwd: workspace,
    type: 'directory',
  });
};
