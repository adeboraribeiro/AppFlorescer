export type ModuleDefinition = {
    id: string;
    labelKey: string;
    icon: string;
    route: string;
};

export type ManageModulesProps = {
    onClose: () => void;
    onMeasure?: (h: number) => void;
};
