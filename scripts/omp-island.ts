// @ts-nocheck
import { spawn } from "node:child_process";

// Install a copy in OMP's extensions directory; this file does not modify OMP settings.
export default function (pi) {
  // Nested OMP processes inherit this marker from a parent agent's shell.
  if (process.env.OMPCODE === "1") return;

  let sessionId = "";
  let active = false;
  let approvals = 0;
  let asks = 0;
  let lastEvent = "";
  let lastObservedAt = 0;
  let delivery = Promise.resolve();

  function emit(event) {
    if (!sessionId || event === lastEvent) return;
    lastEvent = event;
    lastObservedAt = Math.max(Date.now(), lastObservedAt + 1);
    const payload = JSON.stringify({ sessionId, parentId: "", event, observedAt: lastObservedAt });
    // Serialize deliveries so a fast approval/resolution cannot arrive out of order.
    delivery = delivery.then(() => {
      const { promise, resolve } = Promise.withResolvers();
      const child = spawn("omarchy-shell", ["luinbytes.island", "agentEvent", payload], {
        stdio: "ignore", timeout: 500
      });
      child.on("error", resolve);
      child.on("close", resolve);
      return promise;
    });
  }

  function selectSession(ctx) {
    if (ctx?.hasUI !== true) return false;
    const id = ctx.sessionManager?.getSessionId?.();
    if (typeof id !== "string" || !/^[A-Za-z0-9_.:/-]{1,156}$/.test(id)) return false;
    const next = `omp:${id}`;
    if (sessionId !== next) {
      if (sessionId) emit("SessionEnd");
      sessionId = next;
      active = false;
      approvals = 0;
      asks = 0;
      lastEvent = "";
    }
    return true;
  }

  function resume() {
    emit(approvals > 0 ? "PermissionRequest" : asks > 0 ? "Blocked" : active ? "UserPromptSubmit" : "Stop");
  }

  pi.on("session_start", (_event, ctx) => {
    if (selectSession(ctx)) emit("SessionStart");
  });
  pi.on("session_switch", (_event, ctx) => {
    if (!selectSession(ctx)) return;
    active = false;
    approvals = 0;
    asks = 0;
    emit("SessionStart");
  });
  pi.on("agent_start", (_event, ctx) => {
    if (!selectSession(ctx)) return;
    active = true;
    resume();
  });
  pi.on("tool_approval_requested", (_event, ctx) => {
    if (!selectSession(ctx)) return;
    approvals++;
    resume();
  });
  pi.on("tool_approval_resolved", (_event, ctx) => {
    if (!selectSession(ctx)) return;
    approvals = Math.max(0, approvals - 1);
    resume();
  });
  pi.on("tool_execution_start", (event, ctx) => {
    if (event?.toolName !== "ask" || !selectSession(ctx)) return;
    asks++;
    resume();
  });
  pi.on("tool_execution_end", (event, ctx) => {
    if (event?.toolName !== "ask" || !selectSession(ctx)) return;
    asks = Math.max(0, asks - 1);
    resume();
  });
  pi.on("agent_end", (event) => {
    if (!sessionId || !active || event?.willContinue === true) return;
    active = false;
    resume();
  });
  pi.on("session_shutdown", () => {
    emit("SessionEnd");
    sessionId = "";
  });
}
