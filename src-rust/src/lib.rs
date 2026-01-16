use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use scraper::{Html, Selector};
use std::collections::HashMap;

// Set up panic hook for better error messages in the browser
#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

// BookmarkNode structure
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkNode {
    pub id: String,
    pub title: String,
    pub url: Option<String>,
    pub add_date: u64,
    pub last_modified: u64,
    pub icon: Option<String>,
    pub tags: Vec<String>,
    pub is_duplicate: bool,
    pub children: Vec<BookmarkNode>,
}

impl BookmarkNode {
    fn new(
        id: String,
        title: String,
        url: Option<String>,
        add_date: u64,
    ) -> Self {
        Self {
            id,
            title,
            url,
            add_date,
            last_modified: add_date,
            icon: None,
            tags: Vec::new(),
            is_duplicate: false,
            children: Vec::new(),
        }
    }

    fn is_folder(&self) -> bool {
        self.url.is_none()
    }
}

// Duplicate group structure
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DuplicateGroup {
    pub url: String,
    pub nodes: Vec<BookmarkNode>,
}

// Helper functions for tree operations

// Find a node by ID (mutable)
fn find_node_by_id_mut<'a>(
    nodes: &'a mut [BookmarkNode],
    target_id: &str,
) -> Option<&'a mut BookmarkNode> {
    for node in nodes {
        if node.id == target_id {
            return Some(node);
        }
        if let Some(found) = find_node_by_id_mut(&mut node.children, target_id) {
            return Some(found);
        }
    }
    None
}

// Collect all nodes from tree into a flat vector
fn collect_all_nodes(nodes: &[BookmarkNode], result: &mut Vec<BookmarkNode>) {
    for node in nodes {
        result.push(node.clone());
        collect_all_nodes(&node.children, result);
    }
}

// Remove a node by ID from tree (recursively deletes all children)
fn remove_node_by_id(nodes: &mut Vec<BookmarkNode>, target_id: &str) -> bool {
    for i in (0..nodes.len()).rev() {
        if nodes[i].id == target_id {
            // Found the node - remove it (children are automatically dropped)
            nodes.remove(i);
            return true;
        }
        // Recursively search in children
        if remove_node_by_id(&mut nodes[i].children, target_id) {
            return true;
        }
    }
    false
}

// Parse HTML bookmarks file
#[wasm_bindgen]
pub fn parse_html(html: &str) -> Result<JsValue, JsValue> {
    let document = Html::parse_document(html);
    let mut id_counter = 0;

    // Create root node
    let root_id = "root".to_string();
    let mut root_node = BookmarkNode::new(
        root_id.clone(),
        "Bookmarks".to_string(),
        None,
        0,
    );

    // Recursive parsing function: processes a DT element and returns a BookmarkNode
    fn process_dt_element(
        element: scraper::ElementRef,
        id_counter: &mut u64,
    ) -> Option<BookmarkNode> {
        // Case A: Folder (contains H3 tag)
        if let Some(h3) = element.select(&Selector::parse("h3").unwrap()).next() {
            let title = h3.text().collect::<String>();
            let add_date = h3
                .value()
                .attr("add_date")
                .and_then(|d| d.parse::<u64>().ok())
                .unwrap_or(0)
                * 1000; // Convert seconds to milliseconds

            let folder_id = format!("node_{}", *id_counter);
            *id_counter += 1;

            let mut folder = BookmarkNode::new(folder_id.clone(), title, None, add_date);

            // === Core logic: Find DL element (compatible with Chrome and Netscape) ===
            let mut target_dl = None;

            // Strategy 1: Look for DL inside current DT (modern browser format)
            for child in element.children() {
                if let Some(child_el) = scraper::ElementRef::wrap(child) {
                    if child_el.value().name() == "dl" {
                        target_dl = Some(child_el);
                        break;
                    }
                }
            }

            // Strategy 2: If not found inside, look in siblings (old Netscape format)
            if target_dl.is_none() {
                let mut sibling_node = element.next_sibling();
                while let Some(node) = sibling_node {
                    if let Some(el) = scraper::ElementRef::wrap(node) {
                        if el.value().name() == "dl" {
                            target_dl = Some(el);
                            break;
                        }
                        // Hit another DT or H3 - we've gone too far
                        if el.value().name() == "dt" || el.value().name() == "h3" {
                            break;
                        }
                    }
                    sibling_node = node.next_sibling();
                }
            }

            // If we found a DL, recursively process its DT children
            if let Some(dl_ref) = target_dl {
                for child in dl_ref.children() {
                    if let Some(child_element) = scraper::ElementRef::wrap(child) {
                        if child_element.value().name() == "dt" {
                            if let Some(child_node) = process_dt_element(child_element, id_counter)
                            {
                                folder.children.push(child_node);
                            }
                        }
                    }
                }
            }

            return Some(folder);
        }
        // Case B: Bookmark (contains A tag)
        else if let Some(a) = element.select(&Selector::parse("a").unwrap()).next() {
            let title = a.text().collect::<String>();
            let url = a.value().attr("href").map(|s| s.to_string());
            let add_date = a
                .value()
                .attr("add_date")
                .and_then(|d| d.parse::<u64>().ok())
                .unwrap_or(0)
                * 1000; // Convert seconds to milliseconds
            let icon = a.value().attr("icon").map(|s| s.to_string());

            let bookmark_id = format!("node_{}", *id_counter);
            *id_counter += 1;

            let mut bookmark = BookmarkNode::new(bookmark_id, title, url, add_date);
            bookmark.icon = icon;

            return Some(bookmark);
        }

        None
    }

    // Find the root DL element
    let dl_selector = Selector::parse("dl").unwrap();
    if let Some(root_dl) = document.select(&dl_selector).next() {
        // Process direct children DT elements of root DL
        for child in root_dl.children() {
            if let Some(child_element) = scraper::ElementRef::wrap(child) {
                if child_element.value().name() == "dt" {
                    if let Some(node) = process_dt_element(child_element, &mut id_counter) {
                        root_node.children.push(node);
                    }
                }
            }
        }
    }

    // Return array containing root node
    let result = vec![root_node];
    serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
}

// Find duplicates by URL
#[wasm_bindgen]
pub fn find_duplicates(nodes_js: JsValue) -> Result<JsValue, JsValue> {
    let nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    // Collect all nodes from tree into flat vector
    let mut all_nodes = Vec::new();
    collect_all_nodes(&nodes, &mut all_nodes);

    let mut url_map: HashMap<String, Vec<BookmarkNode>> = HashMap::new();

    // Group bookmarks by URL
    for node in all_nodes {
        if let Some(url) = &node.url {
            url_map
                .entry(url.clone())
                .or_insert_with(Vec::new)
                .push(node);
        }
    }

    // Filter to only groups with duplicates
    let duplicates: Vec<DuplicateGroup> = url_map
        .into_iter()
        .filter(|(_, nodes)| nodes.len() > 1)
        .map(|(url, nodes)| DuplicateGroup { url, nodes })
        .collect();

    serde_wasm_bindgen::to_value(&duplicates).map_err(|e| JsValue::from_str(&e.to_string()))
}

// Merge two bookmark trees
#[wasm_bindgen]
pub fn merge_trees(base_js: JsValue, target_js: JsValue) -> Result<JsValue, JsValue> {
    let mut base: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(base_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let target: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(target_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    // Merge by extending base with target trees
    base.extend(target);

    // Mark duplicates recursively
    mark_duplicates_in_tree(&mut base);

    serde_wasm_bindgen::to_value(&base).map_err(|e| JsValue::from_str(&e.to_string()))
}

// Helper function to mark duplicates in tree
fn mark_duplicates_in_tree(nodes: &mut Vec<BookmarkNode>) {
    // Collect all nodes
    let mut all_nodes = Vec::new();
    collect_all_nodes(nodes, &mut all_nodes);

    // Build URL map
    let mut url_map: HashMap<String, Vec<String>> = HashMap::new();
    for node in &all_nodes {
        if let Some(url) = &node.url {
            url_map
                .entry(url.clone())
                .or_insert_with(Vec::new)
                .push(node.id.clone());
        }
    }

    // Mark nodes with duplicate URLs
    for (_, ids) in url_map {
        if ids.len() > 1 {
            for id in ids {
                mark_node_as_duplicate(nodes, &id);
            }
        }
    }
}

// Helper function to mark a node as duplicate
fn mark_node_as_duplicate(nodes: &mut [BookmarkNode], target_id: &str) {
    for node in nodes {
        if node.id == target_id {
            node.is_duplicate = true;
            return;
        }
        mark_node_as_duplicate(&mut node.children, target_id);
    }
}

// Search nodes by query
#[wasm_bindgen]
pub fn search_nodes(nodes_js: JsValue, query: &str) -> Result<JsValue, JsValue> {
    let nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    let query_lower = query.to_lowercase();
    let mut results = Vec::new();

    // Recursive search function
    fn search_recursive(nodes: &[BookmarkNode], query: &str, results: &mut Vec<String>) {
        // Check for tag-specific search
        let is_tag_search = query.starts_with("tag:");
        let tag_query = if is_tag_search {
            query.strip_prefix("tag:").unwrap_or("")
        } else {
            ""
        };

        for node in nodes {
            let matches = if is_tag_search {
                // Tag-specific search
                node.tags.iter().any(|t| t.to_lowercase().contains(tag_query))
            } else {
                // General search across title, URL, and tags
                let title_match = node.title.to_lowercase().contains(query);
                let url_match = node
                    .url
                    .as_ref()
                    .map(|u| u.to_lowercase().contains(query))
                    .unwrap_or(false);
                let tag_match = node.tags.iter().any(|t| t.to_lowercase().contains(query));

                title_match || url_match || tag_match
            };

            if matches {
                results.push(node.id.clone());
            }

            // Recurse into children
            search_recursive(&node.children, query, results);
        }
    }

    search_recursive(&nodes, &query_lower, &mut results);

    serde_wasm_bindgen::to_value(&results).map_err(|e| JsValue::from_str(&e.to_string()))
}

// Export to HTML (Netscape format)
#[wasm_bindgen]
pub fn serialize_to_html(nodes_js: JsValue) -> Result<String, JsValue> {
    let nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    let mut html = String::from("<!DOCTYPE NETSCAPE-Bookmark-file-1>\n");
    html.push_str("<META HTTP-EQUIV=\"Content-Type\" CONTENT=\"text/html; charset=UTF-8\">\n");
    html.push_str("<TITLE>Bookmarks</TITLE>\n");
    html.push_str("<H1>Bookmarks</H1>\n<DL><p>\n");

    fn serialize_nodes(nodes: &[BookmarkNode], html: &mut String, indent: usize) {
        let indent_str = "    ".repeat(indent);

        for node in nodes {
            if node.is_folder() {
                html.push_str(&format!(
                    "{}<DT><H3 ADD_DATE=\"{}\">{}</H3>\n",
                    indent_str, node.add_date, node.title
                ));
                html.push_str(&format!("{}<DL><p>\n", indent_str));
                serialize_nodes(&node.children, html, indent + 1);
                html.push_str(&format!("{}</DL><p>\n", indent_str));
            } else if let Some(url) = &node.url {
                let icon_attr = node
                    .icon
                    .as_ref()
                    .map(|i| format!(" ICON=\"{}\"", i))
                    .unwrap_or_default();
                html.push_str(&format!(
                    "{}<DT><A HREF=\"{}\" ADD_DATE=\"{}\"{}>{}</A>\n",
                    indent_str, url, node.add_date, icon_attr, node.title
                ));
            }
        }
    }

    serialize_nodes(&nodes, &mut html, 1);
    html.push_str("</DL><p>\n");

    Ok(html)
}

// Export to JSON
#[wasm_bindgen]
pub fn serialize_to_json(nodes_js: JsValue) -> Result<String, JsValue> {
    let nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    serde_json::to_string_pretty(&nodes).map_err(|e| JsValue::from_str(&e.to_string()))
}

// Export to CSV
#[wasm_bindgen]
pub fn serialize_to_csv(nodes_js: JsValue) -> Result<String, JsValue> {
    let nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    let mut csv = String::from("Title,URL,Add Date,Tags,Type\n");

    // Flatten tree first
    let mut all_nodes = Vec::new();
    collect_all_nodes(&nodes, &mut all_nodes);

    for node in all_nodes {
        let url = node.url.as_deref().unwrap_or("");
        let tags = node.tags.join(";");
        let node_type = if node.is_folder() { "Folder" } else { "Bookmark" };

        csv.push_str(&format!(
            "\"{}\",\"{}\",{},\"{}\",\"{}\"\n",
            node.title.replace("\"", "\"\""),
            url,
            node.add_date,
            tags,
            node_type
        ));
    }

    Ok(csv)
}

// Export to Markdown
#[wasm_bindgen]
pub fn serialize_to_markdown(nodes_js: JsValue) -> Result<String, JsValue> {
    let nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    let mut md = String::from("# Bookmarks\n\n");

    fn build_markdown(nodes: &[BookmarkNode], md: &mut String, level: usize) {
        let indent = "  ".repeat(level);

        for node in nodes {
            if node.is_folder() {
                md.push_str(&format!("{}## {}\n\n", indent, node.title));
                build_markdown(&node.children, md, level + 1);
            } else if let Some(url) = &node.url {
                md.push_str(&format!("{}- [{}]({})\n", indent, node.title, url));
            }
        }
    }

    build_markdown(&nodes, &mut md, 0);

    Ok(md)
}

// Update a node
#[wasm_bindgen]
pub fn update_node(
    nodes_js: JsValue,
    node_id: &str,
    updates_js: JsValue,
) -> Result<JsValue, JsValue> {
    let mut nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let updates: HashMap<String, serde_json::Value> = serde_wasm_bindgen::from_value(updates_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    if let Some(node) = find_node_by_id_mut(&mut nodes, node_id) {
        // Update title
        if let Some(title) = updates.get("title").and_then(|v| v.as_str()) {
            node.title = title.to_string();
        }
        
        // Update URL (can be null to convert bookmark to folder)
        if updates.contains_key("url") {
            if let Some(url_val) = updates.get("url") {
                if url_val.is_null() {
                    node.url = None;
                } else if let Some(url) = url_val.as_str() {
                    node.url = Some(url.to_string());
                }
            }
        }
        
        // Update tags
        if let Some(tags_val) = updates.get("tags") {
            if let Ok(tags) = serde_json::from_value::<Vec<String>>(tags_val.clone()) {
                node.tags = tags;
            }
        }
        
        // Update icon
        if updates.contains_key("icon") {
            if let Some(icon_val) = updates.get("icon") {
                if icon_val.is_null() {
                    node.icon = None;
                } else if let Some(icon) = icon_val.as_str() {
                    node.icon = Some(icon.to_string());
                }
            }
        }
        
        // Update isDuplicate flag
        if let Some(is_duplicate) = updates.get("isDuplicate").and_then(|v| v.as_bool()) {
            node.is_duplicate = is_duplicate;
        }
        
        // Always update last_modified timestamp
        node.last_modified = js_sys::Date::now() as u64;
    }

    serde_wasm_bindgen::to_value(&nodes).map_err(|e| JsValue::from_str(&e.to_string()))
}

// Delete a node
#[wasm_bindgen]
pub fn delete_node(nodes_js: JsValue, node_id: &str) -> Result<JsValue, JsValue> {
    let mut nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    if !remove_node_by_id(&mut nodes, node_id) {
        return Err(JsValue::from_str(&format!("Node with id '{}' not found", node_id)));
    }

    serde_wasm_bindgen::to_value(&nodes).map_err(|e| JsValue::from_str(&e.to_string()))
}

// Add a node
#[wasm_bindgen]
pub fn add_node(
    nodes_js: JsValue,
    parent_id: &str,
    node_js: JsValue,
) -> Result<JsValue, JsValue> {
    let mut nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    let mut new_node: BookmarkNode = serde_wasm_bindgen::from_value(node_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    new_node.id = format!("node_{}", js_sys::Date::now() as u64);

    // Find parent and add to its children
    if let Some(parent) = find_node_by_id_mut(&mut nodes, parent_id) {
        parent.children.push(new_node);
    } else {
        // Parent not found, add to root
        nodes.push(new_node);
    }

    serde_wasm_bindgen::to_value(&nodes).map_err(|e| JsValue::from_str(&e.to_string()))
}

// Add a tag to a node
#[wasm_bindgen]
pub fn add_tag(nodes_js: JsValue, node_id: &str, tag: &str) -> Result<JsValue, JsValue> {
    let mut nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    if let Some(node) = find_node_by_id_mut(&mut nodes, node_id) {
        if !node.tags.contains(&tag.to_string()) {
            node.tags.push(tag.to_string());
        }
    }

    serde_wasm_bindgen::to_value(&nodes).map_err(|e| JsValue::from_str(&e.to_string()))
}

// Remove a tag from a node
#[wasm_bindgen]
pub fn remove_tag(nodes_js: JsValue, node_id: &str, tag: &str) -> Result<JsValue, JsValue> {
    let mut nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    if let Some(node) = find_node_by_id_mut(&mut nodes, node_id) {
        node.tags.retain(|t| t != tag);
    }

    serde_wasm_bindgen::to_value(&nodes).map_err(|e| JsValue::from_str(&e.to_string()))
}

// Move a node to a new parent
#[wasm_bindgen]
pub fn move_node(
    nodes_js: JsValue,
    node_id: &str,
    new_parent_id: &str,
) -> Result<JsValue, JsValue> {
    let mut nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    // Find and remove the node from its current location
    let mut moved_node: Option<BookmarkNode> = None;
    
    // Helper function to remove node from tree
    fn remove_node_recursive(nodes: &mut Vec<BookmarkNode>, target_id: &str, result: &mut Option<BookmarkNode>) -> bool {
        for i in (0..nodes.len()).rev() {
            if nodes[i].id == target_id {
                *result = Some(nodes.remove(i));
                return true;
            }
            if remove_node_recursive(&mut nodes[i].children, target_id, result) {
                return true;
            }
        }
        false
    }

    if !remove_node_recursive(&mut nodes, node_id, &mut moved_node) {
        return Err(JsValue::from_str(&format!("Node with id '{}' not found", node_id)));
    }

    let node_to_move = moved_node.unwrap();

    // Add node to new parent
    if new_parent_id == "root" || new_parent_id.is_empty() {
        // Add to root level
        nodes.push(node_to_move);
    } else {
        // Find new parent and add to its children
        if let Some(parent) = find_node_by_id_mut(&mut nodes, new_parent_id) {
            parent.children.push(node_to_move);
        } else {
            // Parent not found, restore node to original position and return error
            // We can't easily restore, so just add to root as fallback
            nodes.push(node_to_move);
            return Err(JsValue::from_str(&format!("Parent node with id '{}' not found", new_parent_id)));
        }
    }

    serde_wasm_bindgen::to_value(&nodes).map_err(|e| JsValue::from_str(&e.to_string()))
}
