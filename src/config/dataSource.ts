export const DATA_SOURCE = import.meta.env.VITE_DATA_SOURCE || "demo";

if (DATA_SOURCE !== "demo" && DATA_SOURCE !== "backend") {
  throw new Error("VITE_DATA_SOURCE must be demo or backend.");
}

export const IS_DEMO = DATA_SOURCE === "demo";
