import { useRef } from "react";
import { useNavigate } from "react-router";
import { useProjectStore } from "../stores/projectStore";

export default function HomePage() {
    const navigate = useNavigate();
    const loadProject = useProjectStore((s) => s.loadProject);
    const resetProject = useProjectStore((s) => s.resetProject);
    const fileInputRef = useRef<HTMLInputElement>(null);

    function handleNewProject() {
        resetProject();
        navigate("/edit");
    }

    function handleImportClick() {
        fileInputRef.current?.click();
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result as string);
                if (data.bracketText) {
                    loadProject(data);
                    navigate("/edit");
                }
            } catch {
                // invalid file
            }
        };
        reader.readAsText(file);
        e.target.value = "";
    }

    return (
        <div className="flex h-full flex-col">
            <main className="flex flex-1 flex-col items-center justify-center px-6">
                <div className="flex max-w-2xl flex-col items-center text-center">
                    <p className="mb-4 font-mono text-xs tracking-widest text-secondary uppercase sm:text-sm">
                        The modern syntax tree generator
                    </p>

                    <h1 className="mb-8 text-5xl leading-[1.05] font-bold tracking-tight text-primary sm:text-7xl md:text-8xl">
                        TreeStump
                    </h1>

                    <div className="flex flex-wrap justify-center gap-3">
                        <button
                            onClick={handleNewProject}
                            className="rounded-xl bg-primary px-7 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-80 active:scale-[0.98]"
                        >
                            New Project
                        </button>
                        <button
                            onClick={handleImportClick}
                            className="rounded-xl border border-border px-7 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-surface active:scale-[0.98]"
                        >
                            Import Project
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".treestump,.json"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
