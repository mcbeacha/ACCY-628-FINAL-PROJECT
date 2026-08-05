"use client";

import { useState } from "react";

type NotificationPrefs = {
  deadlineReminders: boolean;
  taskAssignments: boolean;
  clientMessages: boolean;
  documentReview: boolean;
  timekeepingReminders: boolean;
};

export function SettingsPreferences() {
  const [notifications, setNotifications] = useState<NotificationPrefs>({
    deadlineReminders: true,
    taskAssignments: true,
    clientMessages: true,
    documentReview: true,
    timekeepingReminders: true,
  });
  const [landingPage, setLandingPage] = useState("dashboard");
  const [taskView, setTaskView] = useState("list");

  function toggle(key: keyof NotificationPrefs) {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <>
      <section className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">Notifications</h2>
            <p className="text-sm opacity-70 mt-1">
              Preference changes are not persisted yet.
            </p>
          </div>
          <ul className="space-y-3">
            <li className="flex items-center justify-between gap-4">
              <span className="text-sm">Deadline reminders</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={notifications.deadlineReminders}
                onChange={() => toggle("deadlineReminders")}
                aria-label="Deadline reminders"
              />
            </li>
            <li className="flex items-center justify-between gap-4">
              <span className="text-sm">Task assignments</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={notifications.taskAssignments}
                onChange={() => toggle("taskAssignments")}
                aria-label="Task assignments"
              />
            </li>
            <li className="flex items-center justify-between gap-4">
              <span className="text-sm">Client messages</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={notifications.clientMessages}
                onChange={() => toggle("clientMessages")}
                aria-label="Client messages"
              />
            </li>
            <li className="flex items-center justify-between gap-4">
              <span className="text-sm">Document review requests</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={notifications.documentReview}
                onChange={() => toggle("documentReview")}
                aria-label="Document review requests"
              />
            </li>
            <li className="flex items-center justify-between gap-4">
              <span className="text-sm">Timekeeping reminders</span>
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={notifications.timekeepingReminders}
                onChange={() => toggle("timekeepingReminders")}
                aria-label="Timekeeping reminders"
              />
            </li>
          </ul>
        </div>
      </section>

      <section className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">Workspace preferences</h2>
            <p className="text-sm opacity-70 mt-1">
              Preference changes are not persisted yet.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="form-control w-full">
              <span className="label-text text-sm font-medium">Default landing page</span>
              <select
                className="select select-bordered"
                value={landingPage}
                onChange={(e) => setLandingPage(e.target.value)}
                aria-label="Default landing page"
              >
                <option value="dashboard">Dashboard</option>
                <option value="matters">Matters</option>
                <option value="tasks">Tasks</option>
                <option value="calendar">Calendar</option>
                <option value="messages">Messages</option>
              </select>
            </label>
            <label className="form-control w-full">
              <span className="label-text text-sm font-medium">Default task view</span>
              <select
                className="select select-bordered"
                value={taskView}
                onChange={(e) => setTaskView(e.target.value)}
                aria-label="Default task view"
              >
                <option value="list">List</option>
                <option value="board">Board</option>
                <option value="calendar">Calendar</option>
              </select>
            </label>
          </div>
        </div>
      </section>
    </>
  );
}
