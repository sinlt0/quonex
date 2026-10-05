'use client';

import { useActionState } from 'react';
import {
  deletePanelAction,
  addStaffRoleAction,
  removeStaffRoleAction,
  addCategoryAction,
  removeCategoryAction,
  addQuestionAction,
  removeQuestionAction
} from './actions';

const initialState = { ok: null, error: null };

function nameFor(list, id) {
  const match = list.find(item => item.id === id);
  return match ? match.name : id;
}

export default function PanelManageCard({ guildId, panel, categories, roles }) {
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deletePanelAction.bind(null, guildId, panel.id),
    initialState
  );
  const [staffRoleState, staffRoleFormAction, staffRolePending] = useActionState(
    addStaffRoleAction.bind(null, guildId, panel.id),
    initialState
  );
  const [categoryState, categoryFormAction, categoryPending] = useActionState(
    addCategoryAction.bind(null, guildId, panel.id),
    initialState
  );
  const [questionState, questionFormAction, questionPending] = useActionState(
    addQuestionAction.bind(null, guildId, panel.id),
    initialState
  );

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 transition-all duration-150 ease-out hover:border-white/20">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 break-words font-medium">{panel.name}</p>
        <form action={deleteFormAction}>
          <button
            type="submit"
            disabled={deletePending}
            className="text-xs text-red-400 transition-colors duration-150 hover:text-red-300 disabled:opacity-50"
          >
            {deletePending ? 'Deleting...' : 'Delete panel'}
          </button>
        </form>
      </div>
      {deleteState.error && <p className="text-xs text-red-400">{deleteState.error}</p>}
      <p className="break-all text-xs text-neutral-500">{panel.id}</p>

      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Staff roles</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {panel.staffRoleIds.map(roleId => (
            <form key={roleId} action={removeStaffRoleAction.bind(null, guildId, panel.id, roleId)}>
              <button
                type="submit"
                className="rounded-full bg-white/10 px-3 py-1 text-xs transition-colors duration-150 hover:bg-red-500/20 hover:text-red-300"
              >
                {nameFor(roles, roleId)} ×
              </button>
            </form>
          ))}
        </div>
        <form action={staffRoleFormAction} className="mt-2 flex gap-2">
          <select
            name="roleId"
            defaultValue=""
            className="flex-1 rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs outline-none focus:border-violet-500"
          >
            <option value="" disabled>
              Add staff role...
            </option>
            {roles.map(role => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={staffRolePending}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium transition-all duration-150 hover:bg-violet-500 disabled:opacity-50"
          >
            Add
          </button>
        </form>
        {staffRoleState.error && <p className="mt-1 text-xs text-red-400">{staffRoleState.error}</p>}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Ticket categories</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {panel.categoryIds.map(categoryId => (
            <form key={categoryId} action={removeCategoryAction.bind(null, guildId, panel.id, categoryId)}>
              <button
                type="submit"
                className="rounded-full bg-white/10 px-3 py-1 text-xs transition-colors duration-150 hover:bg-red-500/20 hover:text-red-300"
              >
                {nameFor(categories, categoryId)} ×
              </button>
            </form>
          ))}
        </div>
        <form action={categoryFormAction} className="mt-2 flex gap-2">
          <select
            name="categoryId"
            defaultValue=""
            className="flex-1 rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs outline-none focus:border-violet-500"
          >
            <option value="" disabled>
              Add category...
            </option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={categoryPending}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium transition-all duration-150 hover:bg-violet-500 disabled:opacity-50"
          >
            Add
          </button>
        </form>
        {categoryState.error && <p className="mt-1 text-xs text-red-400">{categoryState.error}</p>}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Intake questions</p>
        <ul className="mt-1 space-y-1">
          {panel.questions.map((question, index) => (
            <li key={index} className="flex items-center justify-between gap-2 text-xs text-neutral-300">
              <span className="min-w-0 break-words">
                {index + 1}. {question}
              </span>
              <form action={removeQuestionAction.bind(null, guildId, panel.id, index)}>
                <button type="submit" className="shrink-0 text-red-400 transition-colors duration-150 hover:text-red-300">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={questionFormAction} className="mt-2 flex gap-2">
          <input
            name="question"
            placeholder="New question..."
            className="flex-1 rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={questionPending}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium transition-all duration-150 hover:bg-violet-500 disabled:opacity-50"
          >
            Add
          </button>
        </form>
        {questionState.error && <p className="mt-1 text-xs text-red-400">{questionState.error}</p>}
      </div>
    </div>
  );
}
