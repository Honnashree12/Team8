// Ambient globals for the reference TypeScript modules.
// The extension APIs are provided by the browser at runtime; we don't ship
// @types/chrome, so declare the surface we touch as `any` for typechecking.
declare const chrome: any;
