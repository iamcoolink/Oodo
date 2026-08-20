"use client";

import {
  AlertTriangle,
  Bot,
  Braces,
  CircleUserRound,
  Clipboard,
  Database,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  GripVertical,
  KeyRound,
  LockKeyhole,
  Network,
  Save,
  Search,
  TableProperties,
  UsersRound,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useArtifactContext } from "@/components/thread/artifact";
import { useStreamContext } from "@/providers/Stream";
import { useI18n } from "@/i18n";

import {
  fieldAccessLabel,
  generateAccessCsv,
  generateFieldSecurityNotes,
  generateRecordRulesXml,
} from "./codegen";
import { initialPermissionProject } from "./mock-data";
import {
  applyPermissionPatch,
  parsePermissionPatch,
  validateProject,
} from "./patch";
import type {
  CrudOperation,
  FieldAccess,
  ModelDefinition,
  PermissionProject,
  ValidationFinding,
} from "./types";
import {
  addRoleToProject,
  deleteRoleFromProject,
  normalizePermissionProject,
} from "./utils";

type WorkspaceTab = "map" | "matrix" | "code";
type CodeTab = "acl" | "rules" | "fields";

const FIELD_ACCESS_SEQUENCE: FieldAccess[] = [
  "hidden",
  "readonly",
  "editable",
  "masked",
];

const CRUD_LABELS: Array<{ key: CrudOperation; label: string }> = [
  { key: "read", label: "R" },
  { key: "create", label: "C" },
  { key: "write", label: "W" },
  { key: "unlink", label: "D" },
];

const PROJECT_STORAGE_KEY = "odoo-permission-studio.project";

function loadSavedProject(t: (key: string, ...args: any[]) => string): PermissionProject | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!raw) return null;
    return normalizePermissionProject(JSON.parse(raw), t);
  } catch {
    return null;
  }
}

export function PermissionDesigner(): React.ReactNode {
  const { t } = useI18n();
  const [project, setProject] = useState<PermissionProject>(initialPermissionProject);
  const [selectedRoleId, setSelectedRoleId] = useState(project.roles[0].id);
  const [selectedUserId, setSelectedUserId] = useState(project.users[0].id);
  const [selectedModelId, setSelectedModelId] = useState(
    project.models[0]?.id ?? "",
  );

  useEffect(() => {
    const saved = loadSavedProject(t);
    if (!saved) return;
    setProject(saved);
    setSelectedRoleId(saved.roles[0]?.id ?? "");
    setSelectedUserId(saved.users[0]?.id ?? "");
    setSelectedModelId(saved.models[0]?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("map");
  const [codeTab, setCodeTab] = useState<CodeTab>("acl");
  const [query, setQuery] = useState("");
  const [findingsOpen, setFindingsOpen] = useState(false);
  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleTechnicalName, setNewRoleTechnicalName] = useState("");
  const [, setArtifactContext] = useArtifactContext();
  const stream = useStreamContext();
  const appliedMessageIdRef = useRef<string | null>(null);

  const selectedRole =
    project.roles.find((role) => role.id === selectedRoleId) ?? project.roles[0]!;
  const selectedUser =
    project.users.find((user) => user.id === selectedUserId) ?? project.users[0]!;
  const selectedModel =
    project.models.find((model) => model.id === selectedModelId) ??
    project.models[0]!;

  const findings = useMemo(() => validateProject(project, t), [project, t]);
  const filteredModels = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return project.models;
    return project.models.filter(
      (model) =>
        model.name.toLowerCase().includes(normalized) ||
        model.technicalName.toLowerCase().includes(normalized) ||
        model.fields.some(
          (field) =>
            field.name.toLowerCase().includes(normalized) ||
            field.technicalName.toLowerCase().includes(normalized),
        ),
    );
  }, [project.models, query]);

  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    setArtifactContext((current) => ({
      ...current,
      permission_design: {
        project: projectRef.current,
        selectedRoleId,
        selectedUserId,
        selectedModelId,
        response_contract: {
          format: "permission_patch",
          instruction:
            "When changing the visual design, include one fenced ```permission_patch JSON block with an operations array.",
        },
      },
    }));
  }, [
    selectedModelId,
    selectedRoleId,
    selectedUserId,
    setArtifactContext,
  ]);

  useEffect(() => {
    const lastMessage = [...stream.messages]
      .reverse()
      .find((message) => message.type === "ai");
    if (!lastMessage || lastMessage.id === appliedMessageIdRef.current) return;

    const patch = parsePermissionPatch(lastMessage.content);
    if (!patch) return;

    appliedMessageIdRef.current = lastMessage.id ?? null;
    setProject((current) => {
      const { project: nextProject, skipped } = applyPermissionPatch(
        current,
        patch,
        t,
      );
      if (skipped.length > 0) {
        toast.warning(t("designer.toast.patchPartial"), {
          description: skipped.join("；"),
        });
      } else {
        toast.success(t("designer.toast.patchSuccess"), {
          description:
            patch.summary || t("designer.toast.patchSummary", patch.operations.length),
        });
      }
      return nextProject;
    });
  }, [stream.messages, t]);

  const updateModel = (modelId: string, updater: (model: ModelDefinition) => ModelDefinition) => {
    setProject((current) => ({
      ...current,
      models: current.models.map((model) =>
        model.id === modelId ? updater(model) : model,
      ),
    }));
  };

  const toggleCrud = (modelId: string, operation: CrudOperation) => {
    updateModel(modelId, (model) => ({
      ...model,
      accessByRole: {
        ...model.accessByRole,
        [selectedRoleId]: {
          ...model.accessByRole[selectedRoleId],
          [operation]: !model.accessByRole[selectedRoleId][operation],
        },
      },
    }));
  };

  const setFieldAccess = (
    modelId: string,
    fieldId: string,
    value: FieldAccess,
  ) => {
    updateModel(modelId, (model) => ({
      ...model,
      fields: model.fields.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              accessByRole: {
                ...field.accessByRole,
                [selectedRoleId]: value,
              },
            }
          : field,
      ),
    }));
  };

  const cycleFieldAccess = (modelId: string, fieldId: string) => {
    const model = project.models.find((item) => item.id === modelId);
    const field = model?.fields.find((item) => item.id === fieldId);
    if (!field) return;
    const current = field.accessByRole[selectedRoleId];
    const next = FIELD_ACCESS_SEQUENCE[
      (FIELD_ACCESS_SEQUENCE.indexOf(current) + 1) % FIELD_ACCESS_SEQUENCE.length
    ];
    setFieldAccess(modelId, fieldId, next);
  };

  const setRecordScope = (value: string) => {
    updateModel(selectedModelId, (model) => ({
      ...model,
      recordScopeByRole: {
        ...model.recordScopeByRole,
        [selectedRoleId]: value,
      },
    }));
  };

  const moveModel = (modelId: string, x: number, y: number) => {
    updateModel(modelId, (model) => ({ ...model, position: { x, y } }));
  };

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${project.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const saveProject = () => {
    try {
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
      toast.success(t("designer.toast.saveSuccess"), {
        description: t("designer.toast.saveSuccessDesc"),
      });
    } catch {
      toast.error(t("designer.toast.saveError"), {
        description: t("designer.toast.saveErrorDesc"),
      });
    }
  };

  const importInputRef = useRef<HTMLInputElement | null>(null);

  const importProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        const imported = normalizePermissionProject(raw, t);
        setProject(imported);
        setSelectedRoleId(imported.roles[0]?.id ?? project.roles[0].id);
        setSelectedUserId(imported.users[0]?.id ?? project.users[0].id);
        setSelectedModelId(imported.models[0]?.id ?? "");
        toast.success(t("designer.toast.importSuccess"), {
          description: t(
            "designer.toast.importSuccessDesc",
            file.name,
            imported.models.length,
            imported.roles.length,
          ),
        });
      } catch (error) {
        toast.error(t("designer.toast.importError"), {
          description: error instanceof Error ? error.message : t("designer.toast.importErrorDesc"),
        });
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleAddRole = () => {
    if (!newRoleName.trim() || !newRoleTechnicalName.trim()) {
      toast.error(t("designer.toast.addRoleError"));
      return;
    }
    try {
      const updated = addRoleToProject(
        project,
        newRoleName.trim(),
        newRoleTechnicalName.trim(),
        t,
      );
      setProject(updated);
      setSelectedRoleId(updated.roles[updated.roles.length - 1].id);
      setNewRoleName("");
      setNewRoleTechnicalName("");
      setIsAddRoleOpen(false);
      toast.success(t("designer.toast.addRoleSuccess"), { description: newRoleName.trim() });
    } catch (error) {
      toast.error(t("designer.toast.genericError"), {
        description: error instanceof Error ? error.message : t("designer.toast.genericError"),
      });
    }
  };

  const handleDeleteRole = (roleId: string) => {
    if (project.roles.length <= 1) {
      toast.error(t("designer.toast.deleteRoleError"));
      return;
    }
    try {
      const updated = deleteRoleFromProject(project, roleId, t);
      setProject(updated);
      if (selectedRoleId === roleId) {
        setSelectedRoleId(updated.roles[0].id);
      }
      if (selectedUserId && !updated.users.some((u) => u.id === selectedUserId)) {
        setSelectedUserId(updated.users[0].id);
      }
      toast.success(t("designer.toast.deleteRoleSuccess"));
    } catch (error) {
      toast.error(t("designer.toast.genericError"), {
        description: error instanceof Error ? error.message : t("designer.toast.genericError"),
      });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 text-slate-900">
      <header className="flex h-16 shrink-0 items-center justify-end border-b bg-white px-5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFindingsOpen((open) => !open)}
            className="relative inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm hover:bg-slate-50"
          >
            <AlertTriangle className="size-4" />
            {t("designer.buttons.check")}
            {findings.length > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 text-xs text-amber-800">
                {findings.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={exportProject}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm hover:bg-slate-50"
          >
            <Download className="size-4" />
            {t("designer.buttons.exportJson")}
          </button>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-md border bg-white px-3 text-sm hover:bg-slate-50"
          >
            <Clipboard className="size-4" />
            {t("designer.buttons.importJson")}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={importProject}
            className="hidden"
          />
          <button
            type="button"
            onClick={saveProject}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-[#714B67] px-3 text-sm font-medium text-white hover:bg-[#5C3D54]"
          >
            <Save className="size-4" />
            {t("designer.buttons.save")}
          </button>
        </div>
      </header>

      <div className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-4">
        <nav className="flex h-full items-center gap-1">
          <TabButton active={activeTab === "map"} onClick={() => setActiveTab("map")} icon={<Network />}>
            {t("designer.tabs.map")}
          </TabButton>
          <TabButton active={activeTab === "matrix"} onClick={() => setActiveTab("matrix")} icon={<TableProperties />}>
            {t("designer.tabs.matrix")}
          </TabButton>
          <TabButton active={activeTab === "code"} onClick={() => setActiveTab("code")} icon={<FileCode2 />}>
            {t("designer.tabs.code")}
          </TabButton>
        </nav>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-500">
            <CircleUserRound className="size-4" />
            {t("designer.simulateUser")}
            <select
              value={selectedUserId}
              onChange={(event) => {
                const userId = event.target.value;
                const user = project.users.find((item) => item.id === userId);
                setSelectedUserId(userId);
                if (user?.roleIds[0]) setSelectedRoleId(user.roleIds[0]);
              }}
              className="h-8 rounded-md border bg-white px-2 text-sm text-slate-800"
            >
              {project.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700">
            {selectedUser.company}
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {activeTab === "map" && (
          <AccessMap
            project={project}
            filteredModels={filteredModels}
            selectedRoleId={selectedRoleId}
            selectedModelId={selectedModelId}
            query={query}
            onQueryChange={setQuery}
            onSelectRole={setSelectedRoleId}
            onSelectModel={setSelectedModelId}
            onToggleCrud={toggleCrud}
            onCycleFieldAccess={cycleFieldAccess}
            onMoveModel={moveModel}
            onAddRoleClick={() => setIsAddRoleOpen(true)}
            onDeleteRole={handleDeleteRole}
          />
        )}
        {activeTab === "matrix" && (
          <FieldMatrix
            project={project}
            selectedRoleId={selectedRoleId}
            onSelectRole={setSelectedRoleId}
            onSetFieldAccess={setFieldAccess}
          />
        )}
        {activeTab === "code" && (
          <CodeGenerator
            project={project}
            activeTab={codeTab}
            onTabChange={setCodeTab}
          />
        )}

        {activeTab === "map" && (
          <ModelInspector
            roleName={selectedRole.name}
            model={selectedModel}
            roleId={selectedRoleId}
            onToggleCrud={(operation) => toggleCrud(selectedModel.id, operation)}
            onSetFieldAccess={(fieldId, value) =>
              setFieldAccess(selectedModel.id, fieldId, value)
            }
            onSetRecordScope={setRecordScope}
          />
        )}

        {findingsOpen && (
          <FindingsPanel findings={findings} onClose={() => setFindingsOpen(false)} />
        )}
      </div>

      <footer className="flex h-9 shrink-0 items-center justify-between border-t bg-white px-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Bot className="size-3.5 text-[#714B67]" />
          <span dangerouslySetInnerHTML={{ __html: t("designer.contextInfo") }} />
        </div>
        <div className="flex items-center gap-3">
          <span>{t("designer.counts.roles", project.roles.length)}</span>
          <span>{t("designer.counts.models", project.models.length)}</span>
          <span>{t("designer.counts.fields", project.models.reduce((sum, model) => sum + model.fields.length, 0))}</span>
        </div>
      </footer>

      {isAddRoleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold">{t("designer.addRole.title")}</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-500">{t("designer.addRole.nameLabel")}</label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder={t("designer.addRole.namePlaceholder")}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[#714B67]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500">{t("designer.addRole.technicalLabel")}</label>
                <input
                  type="text"
                  value={newRoleTechnicalName}
                  onChange={(e) => setNewRoleTechnicalName(e.target.value)}
                  placeholder={t("designer.addRole.technicalPlaceholder")}
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[#714B67]"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddRoleOpen(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                {t("designer.addRole.cancel")}
              </button>
              <button
                type="button"
                onClick={handleAddRole}
                className="rounded-lg bg-[#714B67] px-3 py-1.5 text-sm text-white hover:bg-[#5C3D54]"
              >
                {t("designer.addRole.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton(props: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactElement;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex h-10 items-center gap-2 rounded-lg px-3 text-sm transition ${
        props.active
          ? "bg-[#F5E6F0] font-medium text-[#714B67]"
          : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span className="[&>svg]:size-4">{props.icon}</span>
      {props.children}
    </button>
  );
}

function AccessMap(props: {
  project: PermissionProject;
  filteredModels: ModelDefinition[];
  selectedRoleId: string;
  selectedModelId: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSelectRole: (roleId: string) => void;
  onSelectModel: (modelId: string) => void;
  onToggleCrud: (modelId: string, operation: CrudOperation) => void;
  onCycleFieldAccess: (modelId: string, fieldId: string) => void;
  onMoveModel: (modelId: string, x: number, y: number) => void;
  onAddRoleClick: () => void;
  onDeleteRole: (roleId: string) => void;
}) {
  const { t } = useI18n();
  const dragRef = useRef<{
    modelId: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  // Measure actual DOM positions of role cards for accurate SVG line endpoints
  const roleCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const [rolePositions, setRolePositions] = useState<Map<string, { x: number; y: number; h: number }>>(new Map());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const containerRect = container.getBoundingClientRect();
      const newPositions = new Map<string, { x: number; y: number; h: number }>();
      for (const role of props.project.roles) {
        const el = roleCardRefs.current.get(role.id);
        if (el) {
          const r = el.getBoundingClientRect();
          newPositions.set(role.id, {
            x: r.right - containerRect.left,
            y: r.top - containerRect.top,
            h: r.height,
          });
        }
      }
      setRolePositions(newPositions);
    };

    measure();

    // Observe role card size changes (e.g., delete button appearing on hover)
    const observer = new ResizeObserver(measure);
    for (const el of roleCardRefs.current.values()) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, [props.project.roles]);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      props.onMoveModel(
        drag.modelId,
        Math.max(20, Math.min(1180, drag.originX + event.clientX - drag.startX)),
        Math.max(20, Math.min(560, drag.originY + event.clientY - drag.startY)),
      );
    };
    const up = () => {
      dragRef.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [props]);

  return (
    <div className="absolute inset-0 right-[320px] overflow-auto bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,.28)_1px,transparent_0)] bg-[size:22px_22px]">
      <div className="sticky top-0 z-30 flex h-12 items-center justify-between border-b bg-white/90 px-4 backdrop-blur">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Network className="size-4 text-[#714B67]" />
          {t("designer.map.title")}
        </div>
        <label className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
          <input
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
            placeholder={t("designer.map.searchPlaceholder")}
            className="h-9 w-64 rounded-md border bg-white pl-9 pr-3 text-sm outline-none focus:border-[#B88AAE]"
          />
        </label>
      </div>
      <div ref={containerRef} className="relative h-[610px] min-w-full">
        <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
          {props.project.roles.map((role) => {
            const pos = rolePositions.get(role.id);
            if (!pos) return null;
            return props.filteredModels.map((model) => {
              const access = model.accessByRole[role.id];
              if (!access?.read) return null;
              const startX = pos.x;
              const startY = pos.y + pos.h / 2;
              const endX = model.position.x;
              const endY = model.position.y + 58;
              const selected = role.id === props.selectedRoleId;
              return (
                <path
                  key={`${role.id}-${model.id}`}
                  d={`M ${startX} ${startY} C ${startX + 55} ${startY}, ${endX - 70} ${endY}, ${endX} ${endY}`}
                  fill="none"
                  stroke={selected ? "#714B67" : "#cbd5e1"}
                  strokeWidth={selected ? 2.2 : 1.1}
                  strokeDasharray={access.write ? undefined : "5 5"}
                  opacity={selected ? 0.9 : 0.42}
                />
              );
            });
          })}
        </svg>

        <div className="absolute left-5 top-5 w-40 space-y-4">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-400">
            <div className="flex items-center gap-2">
              <UsersRound className="size-4" /> {t("designer.map.rolesLabel")}
            </div>
            <button
              type="button"
              onClick={props.onAddRoleClick}
              className="rounded-md bg-[#F5E6F0] px-2 py-1 text-[10px] text-[#714B67] hover:bg-[#EBD5E8]"
            >
              {t("designer.buttons.add")}
            </button>
          </div>
          {props.project.roles.map((role) => (
            <div
              key={role.id}
              ref={(el) => {
                if (el) roleCardRefs.current.set(role.id, el);
                else roleCardRefs.current.delete(role.id);
              }}
              className={`group relative w-full rounded-xl border p-3 text-left shadow-sm transition ${
                role.id === props.selectedRoleId
                  ? "border-[#B88AAE] bg-[#F5E6F0] ring-2 ring-[#F5E6F0]"
                  : "bg-white hover:border-slate-300"
              }`}
            >
              <button
                type="button"
                onClick={() => props.onSelectRole(role.id)}
                className="w-full text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{role.name}</span>
                  <KeyRound className="size-4 text-slate-400" />
                </div>
                <div className="mt-1 truncate text-[11px] text-slate-500">{role.technicalName}</div>
              </button>
              {props.project.roles.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onDeleteRole(role.id);
                  }}
                  className="absolute -right-2 -top-2 hidden rounded-full bg-red-50 p-1 text-red-500 shadow-sm hover:bg-red-100 group-hover:block"
                  title={t("designer.map.deleteRoleTooltip")}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {props.filteredModels.map((model) => (
          <div
            key={model.id}
            className={`absolute w-[220px] overflow-hidden rounded-xl border bg-white shadow-md transition-shadow ${
              model.id === props.selectedModelId
                ? "border-[#B88AAE] ring-2 ring-[#F5E6F0]"
                : "border-slate-200 hover:shadow-lg"
            }`}
            style={{ left: model.position.x, top: model.position.y }}
            onClick={() => props.onSelectModel(model.id)}
          >
            <div className="flex cursor-grab items-start gap-2 border-b bg-slate-50 px-3 py-2.5 active:cursor-grabbing"
              onPointerDown={(event) => {
                event.preventDefault();
                dragRef.current = {
                  modelId: model.id,
                  startX: event.clientX,
                  startY: event.clientY,
                  originX: model.position.x,
                  originY: model.position.y,
                };
              }}
            >
              <GripVertical className="mt-0.5 size-4 shrink-0 text-slate-400" />
              <Database className="mt-0.5 size-4 shrink-0 text-[#714B67]" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{model.name}</div>
                <div className="truncate text-[11px] text-slate-500">{model.technicalName}</div>
              </div>
            </div>
            <div className="space-y-1.5 p-2.5">
              {model.fields.slice(0, 4).map((field) => {
                const access = field.accessByRole[props.selectedRoleId];
                return (
                  <button
                    key={field.id}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onCycleFieldAccess(model.id, field.id);
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">{field.name}</span>
                      <span className="block truncate text-[10px] text-slate-400">{field.technicalName}</span>
                    </span>
                    <AccessBadge value={access} compact />
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t px-3 py-2">
              <span className="text-[10px] text-slate-400">{model.module}</span>
              <div className="flex gap-1">
                {CRUD_LABELS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onToggleCrud(model.id, key);
                    }}
                    className={`grid size-5 place-items-center rounded text-[10px] font-semibold ${
                      model.accessByRole[props.selectedRoleId][key]
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-400"
                    }`}
                    title={key}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelInspector(props: {
  roleName: string;
  roleId: string;
  model: ModelDefinition;
  onToggleCrud: (operation: CrudOperation) => void;
  onSetFieldAccess: (fieldId: string, value: FieldAccess) => void;
  onSetRecordScope: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <aside className="absolute inset-y-0 right-0 w-[320px] overflow-y-auto border-l bg-white">
      <div className="border-b p-4">
        <div className="flex items-start gap-3">
          <div className="grid size-9 place-items-center rounded-lg bg-[#F5E6F0] text-[#714B67]">
            <Database className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold">{props.model.name}</h2>
            <p className="truncate text-xs text-slate-500">{props.model.technicalName}</p>
          </div>
        </div>
        <div
          className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"
          dangerouslySetInnerHTML={{ __html: t("designer.inspector.editing", props.roleName) }}
        />
      </div>

      <InspectorSection title={t("designer.inspector.modelAcl")} icon={<LockKeyhole />}>
        <div className="grid grid-cols-4 gap-2">
          {CRUD_LABELS.map(({ key, label }) => {
            const enabled = props.model.accessByRole[props.roleId][key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => props.onToggleCrud(key)}
                className={`rounded-lg border px-2 py-2 text-center transition ${
                  enabled
                    ? "border-[#00A09D] bg-[#E6F4F3] text-[#00A09D]"
                    : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                <div className="text-sm font-bold">{label}</div>
                <div className="mt-0.5 text-[9px] uppercase">{key}</div>
              </button>
            );
          })}
        </div>
      </InspectorSection>

      <InspectorSection title={t("designer.inspector.recordScope")} icon={<Braces />}>
        <textarea
          value={props.model.recordScopeByRole[props.roleId]}
          onChange={(event) => props.onSetRecordScope(event.target.value)}
          rows={5}
          className="w-full rounded-md border bg-slate-950 p-3 font-mono text-[11px] leading-5 text-[#00A09D] outline-none focus:border-[#B88AAE]"
        />
        <p
          className="mt-2 text-[11px] leading-4 text-slate-500"
          dangerouslySetInnerHTML={{ __html: t("designer.inspector.recordScopeHint") }}
        />
      </InspectorSection>

      <InspectorSection title={t("designer.inspector.fieldAccess")} icon={<TableProperties />}>
        <div className="space-y-2">
          {props.model.fields.map((field) => (
            <div key={field.id} className="rounded-lg border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium">{field.name}</div>
                  <div className="truncate text-[10px] text-slate-400">{field.technicalName}</div>
                </div>
                <select
                  value={field.accessByRole[props.roleId]}
                  onChange={(event) =>
                    props.onSetFieldAccess(field.id, event.target.value as FieldAccess)
                  }
                  className="h-7 rounded-sm border bg-white px-1.5 text-[11px]"
                >
                  {FIELD_ACCESS_SEQUENCE.map((access) => (
                    <option key={access} value={access}>
                      {fieldAccessLabel(access, t)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
      </InspectorSection>
    </aside>
  );
}

function InspectorSection(props: {
  title: string;
  icon: React.ReactElement;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b p-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span className="[&>svg]:size-3.5">{props.icon}</span>
        {props.title}
      </h3>
      {props.children}
    </section>
  );
}

function FieldMatrix(props: {
  project: PermissionProject;
  selectedRoleId: string;
  onSelectRole: (roleId: string) => void;
  onSetFieldAccess: (modelId: string, fieldId: string, value: FieldAccess) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="absolute inset-0 overflow-auto p-5">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="font-semibold">{t("designer.matrix.title")}</h2>
            <p className="mt-1 text-xs text-slate-500">{t("designer.matrix.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-1">
            {props.project.roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => props.onSelectRole(role.id)}
                className={`rounded-md px-3 py-1.5 text-xs ${
                  role.id === props.selectedRoleId
                    ? "bg-white font-medium text-[#714B67] shadow-sm"
                    : "text-slate-500"
                }`}
              >
                {role.name}
              </button>
            ))}
          </div>
        </div>
        <table className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="border-b px-4 py-3">{t("designer.matrix.modelColumn")}</th>
              <th className="border-b px-4 py-3">{t("designer.matrix.fieldColumn")}</th>
              <th className="border-b px-4 py-3">{t("designer.matrix.technicalNameColumn")}</th>
              {props.project.roles.map((role) => (
                <th key={role.id} className="border-b px-3 py-3 text-center">
                  {role.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.project.models.flatMap((model) =>
              model.fields.map((field, index) => (
                <tr key={`${model.id}-${field.id}`} className="hover:bg-slate-50/60">
                  <td className="border-b px-4 py-3 text-xs font-medium">
                    {index === 0 ? model.name : ""}
                  </td>
                  <td className="border-b px-4 py-3 text-xs">{field.name}</td>
                  <td className="border-b px-4 py-3 font-mono text-[11px] text-slate-500">
                    {field.technicalName}
                  </td>
                  {props.project.roles.map((role) => (
                    <td key={role.id} className="border-b px-3 py-2 text-center">
                      <select
                        value={field.accessByRole[role.id]}
                        onChange={(event) =>
                          props.onSetFieldAccess(
                            model.id,
                            field.id,
                            event.target.value as FieldAccess,
                          )
                        }
                        className="h-7 rounded-sm border bg-white px-1.5 text-[11px]"
                      >
                        {FIELD_ACCESS_SEQUENCE.map((access) => (
                          <option key={access} value={access}>
                            {fieldAccessLabel(access, t)}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CodeGenerator(props: {
  project: PermissionProject;
  activeTab: CodeTab;
  onTabChange: (tab: CodeTab) => void;
}) {
  const { t } = useI18n();
  const code =
    props.activeTab === "acl"
      ? generateAccessCsv(props.project)
      : props.activeTab === "rules"
        ? generateRecordRulesXml(props.project)
        : generateFieldSecurityNotes(props.project, t);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    toast.success(t("designer.toast.copySuccess"));
  };

  return (
    <div className="absolute inset-0 overflow-auto p-5">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="font-semibold">{t("designer.code.title")}</h2>
            <p className="mt-1 text-xs text-slate-500">{t("designer.code.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm hover:bg-slate-50"
          >
            <Clipboard className="size-4" /> {t("designer.buttons.copy")}
          </button>
        </div>
        <div className="flex gap-1 border-b p-2">
          <CodeTabButton active={props.activeTab === "acl"} onClick={() => props.onTabChange("acl")}>{t("designer.code.tabs.acl")}</CodeTabButton>
          <CodeTabButton active={props.activeTab === "rules"} onClick={() => props.onTabChange("rules")}>{t("designer.code.tabs.rules")}</CodeTabButton>
          <CodeTabButton active={props.activeTab === "fields"} onClick={() => props.onTabChange("fields")}>{t("designer.code.tabs.fields")}</CodeTabButton>
        </div>
        <pre className="min-h-[580px] overflow-auto bg-slate-950 p-5 text-xs leading-5 text-slate-200">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

function CodeTabButton(props: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-lg px-3 py-2 text-xs ${
        props.active ? "bg-[#F5E6F0] font-medium text-[#714B67]" : "text-slate-500 hover:bg-slate-50"
      }`}
    >
      {props.children}
    </button>
  );
}

function FindingsPanel(props: {
  findings: ValidationFinding[];
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="absolute right-4 top-4 z-50 w-[390px] overflow-hidden rounded-2xl border bg-white shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="font-semibold">{t("designer.findings.title")}</h3>
          <p className="text-xs text-slate-500">{t("designer.findings.count", props.findings.length)}</p>
        </div>
        <button type="button" onClick={props.onClose} className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">
          {t("designer.findings.close")}
        </button>
      </div>
      <div className="max-h-[520px] space-y-2 overflow-y-auto p-3">
        {props.findings.length === 0 ? (
          <div className="rounded-xl bg-[#E6F4F3] p-4 text-sm text-[#00A09D]">{t("designer.findings.empty")}</div>
        ) : (
          props.findings.map((finding) => (
            <div key={finding.id} className="rounded-xl border p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className={`mt-0.5 size-4 shrink-0 ${
                    finding.severity === "error"
                      ? "text-red-500"
                      : finding.severity === "warning"
                        ? "text-amber-500"
                        : "text-blue-500"
                  }`}
                />
                <div>
                  <div className="text-sm font-medium">{finding.title}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{finding.detail}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AccessBadge(props: { value: FieldAccess; compact?: boolean }) {
  const { t } = useI18n();
  const style = {
    hidden: "bg-slate-100 text-slate-500",
    readonly: "bg-orange-50 text-orange-700",
    editable: "bg-[#E6F4F3] text-[#00A09D]",
    masked: "bg-purple-50 text-purple-700",
  }[props.value];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full ${style} ${props.compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]"}`}>
      {props.value === "hidden" ? <EyeOff className="size-2.5" /> : <Eye className="size-2.5" />}
      {fieldAccessLabel(props.value, t)}
    </span>
  );
}
