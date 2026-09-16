import { createRouter } from "@tanstack/react-router";
import { AppErrorComponent } from "@/lib/error-component";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const raw = import.meta.env.BASE_URL || "/";
  const basepath = raw === "/" ? undefined : raw.replace(/\/$/, "");
  return createRouter({ routeTree, defaultErrorComponent: AppErrorComponent, basepath });
}
