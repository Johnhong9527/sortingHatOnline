/* tslint:disable */
/* eslint-disable */

export function add_node(nodes_js: any, parent_id: string, node_js: any): any;

export function add_tag(nodes_js: any, node_id: string, tag: string): any;

/**
 * Auto-group bookmarks by domain within a target folder
 * Creates subfolders for each domain and moves bookmarks into them
 */
export function auto_group_by_domain(nodes_js: any, target_folder_id: string): any;

export function delete_node(nodes_js: any, node_id: string): any;

export function find_duplicates(nodes_js: any): any;

export function init_panic_hook(): void;

export function merge_trees(base_js: any, target_js: any): any;

export function move_node(nodes_js: any, node_id: string, new_parent_id: string): any;

export function move_node_relative(nodes_js: any, node_id: string, sibling_id: string, position: string): any;

export function parse_html(html: string): any;

export function remove_tag(nodes_js: any, node_id: string, tag: string): any;

export function search_nodes(nodes_js: any, query: string): any;

export function serialize_to_csv(nodes_js: any): string;

export function serialize_to_html(nodes_js: any): string;

export function serialize_to_json(nodes_js: any): string;

export function serialize_to_markdown(nodes_js: any): string;

export function update_node(nodes_js: any, node_id: string, updates_js: any): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly add_node: (a: any, b: number, c: number, d: any) => [number, number, number];
    readonly add_tag: (a: any, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly auto_group_by_domain: (a: any, b: number, c: number) => [number, number, number];
    readonly delete_node: (a: any, b: number, c: number) => [number, number, number];
    readonly find_duplicates: (a: any) => [number, number, number];
    readonly init_panic_hook: () => void;
    readonly merge_trees: (a: any, b: any) => [number, number, number];
    readonly move_node: (a: any, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly move_node_relative: (a: any, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number];
    readonly parse_html: (a: number, b: number) => [number, number, number];
    readonly remove_tag: (a: any, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly search_nodes: (a: any, b: number, c: number) => [number, number, number];
    readonly serialize_to_csv: (a: any) => [number, number, number, number];
    readonly serialize_to_html: (a: any) => [number, number, number, number];
    readonly serialize_to_json: (a: any) => [number, number, number, number];
    readonly serialize_to_markdown: (a: any) => [number, number, number, number];
    readonly update_node: (a: any, b: number, c: number, d: any) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
