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
    pub parent_id: Option<String>,
    pub title: String,
    pub url: Option<String>,
    pub add_date: u64,
    pub last_modified: u64,
    pub icon: Option<String>,
    pub tags: Vec<String>,
    pub is_duplicate: bool,
}

impl BookmarkNode {
    fn new(
        id: String,
        parent_id: Option<String>,
        title: String,
        url: Option<String>,
        add_date: u64,
    ) -> Self {
        Self {
            id,
            parent_id,
            title,
            url,
            add_date,
            last_modified: add_date,
            icon: None,
            tags: Vec::new(),
            is_duplicate: false,
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

// Parse HTML bookmarks file
#[wasm_bindgen]
pub fn parse_html(html: &str) -> Result<JsValue, JsValue> {
    let document = Html::parse_document(html);
    let mut nodes = Vec::new();
    let mut id_counter = 0;

    // Create virtual root node
    let root_id = "root".to_string();
    let root_node = BookmarkNode::new(
        root_id.clone(),
        None,
        "Bookmarks".to_string(),
        None,
        0,
    );
    nodes.push(root_node);

    // Recursive parsing function
    fn parse_node(
        element: scraper::ElementRef, // Current DT element
        parent_id: Option<String>,
        nodes: &mut Vec<BookmarkNode>,
        id_counter: &mut u64,
    ) {
        // 1. Check if this is a folder (contains H3 tag)
        if let Some(h3) = element.select(&Selector::parse("h3").unwrap()).next() {
            let title = h3.text().collect::<String>();
            let add_date = h3
                .value()
                .attr("add_date")
                .and_then(|d| d.parse::<u64>().ok())
                .unwrap_or(0) * 1000; // Convert seconds to milliseconds

            let folder_id = format!("node_{}", *id_counter);
            *id_counter += 1;

            let folder = BookmarkNode::new(
                folder_id.clone(),
                parent_id.clone(),
                title,
                None,
                add_date,
            );
            nodes.push(folder);

            // === Core fix: Dual search strategy for DL element ===
            // Different browsers export different HTML structures:
            // - Chrome/Edge: DL is a child of DT
            // - Old Netscape: DL is a sibling of DT

            let mut target_dl = None;

            // Strategy A: Look for DL inside current DT (modern browser format)
            for child in element.children() {
                if let Some(child_el) = scraper::ElementRef::wrap(child) {
                    if child_el.value().name() == "dl" {
                        target_dl = Some(child_el);
                        break;
                    }
                }
            }

            // Strategy B: If not found inside, look in siblings (old Netscape format)
            // Must loop to skip Text Nodes (whitespace/newlines)
            if target_dl.is_none() {
                let mut sibling_node = element.next_sibling();
                while let Some(node) = sibling_node {
                    if let Some(el) = scraper::ElementRef::wrap(node) {
                        // Found DL - this is what we're looking for
                        if el.value().name() == "dl" {
                            target_dl = Some(el);
                            break;
                        }
                        // Hit another DT or H3 - we've gone too far
                        if el.value().name() == "dt" || el.value().name() == "h3" {
                            break;
                        }
                    }
                    // Continue to next sibling, skipping whitespace text nodes
                    sibling_node = node.next_sibling();
                }
            }

            // If we found a DL, recursively parse its contents
            if let Some(dl_ref) = target_dl {
                for child in dl_ref.children() {
                    if let Some(child_element) = scraper::ElementRef::wrap(child) {
                        // Only DT elements contain bookmarks or folders
                        if child_element.value().name() == "dt" {
                            parse_node(child_element, Some(folder_id.clone()), nodes, id_counter);
                        }
                    }
                }
            }
            // === End of core fix ===
        }
        // 2. Check if this is a bookmark (contains A tag)
        else if let Some(a) = element.select(&Selector::parse("a").unwrap()).next() {
            let title = a.text().collect::<String>();
            let url = a.value().attr("href").map(|s| s.to_string());
            let add_date = a
                .value()
                .attr("add_date")
                .and_then(|d| d.parse::<u64>().ok())
                .unwrap_or(0) * 1000; // Convert seconds to milliseconds
            let icon = a.value().attr("icon").map(|s| s.to_string());

            let bookmark_id = format!("node_{}", *id_counter);
            *id_counter += 1;

            let mut bookmark = BookmarkNode::new(
                bookmark_id,
                parent_id.clone(),
                title,
                url,
                add_date,
            );
            bookmark.icon = icon;
            nodes.push(bookmark);
        }
    }

    // Find the root DL element
    let dl_selector = Selector::parse("dl").unwrap();
    if let Some(root_dl) = document.select(&dl_selector).next() {
        // Parse direct children DT elements of root DL
        for child in root_dl.children() {
            if let Some(child_element) = scraper::ElementRef::wrap(child) {
                if child_element.value().name() == "dt" {
                    parse_node(child_element, Some(root_id.clone()), &mut nodes, &mut id_counter);
                }
            }
        }
    }

    serde_wasm_bindgen::to_value(&nodes).map_err(|e| JsValue::from_str(&e.to_string()))
}

// Find duplicates by URL
#[wasm_bindgen]
pub fn find_duplicates(nodes_js: JsValue) -> Result<JsValue, JsValue> {
    let nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    let mut url_map: HashMap<String, Vec<BookmarkNode>> = HashMap::new();

    // Group bookmarks by URL
    for node in nodes {
        if let Some(url) = &node.url {
            url_map.entry(url.clone()).or_insert_with(Vec::new).push(node);
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

    // Simple merge: append target to base
    // In a real implementation, you'd want more sophisticated merging logic
    base.extend(target);

    // Mark duplicates
    let mut url_map: HashMap<String, Vec<usize>> = HashMap::new();
    for (idx, node) in base.iter().enumerate() {
        if let Some(url) = &node.url {
            url_map.entry(url.clone()).or_insert_with(Vec::new).push(idx);
        }
    }

    for indices in url_map.values() {
        if indices.len() > 1 {
            for &idx in indices {
                base[idx].is_duplicate = true;
            }
        }
    }

    serde_wasm_bindgen::to_value(&base).map_err(|e| JsValue::from_str(&e.to_string()))
}

// Search nodes by query
#[wasm_bindgen]
pub fn search_nodes(nodes_js: JsValue, query: &str) -> Result<JsValue, JsValue> {
    let nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    let query_lower = query.to_lowercase();
    let mut results = Vec::new();

    // Check for tag-specific search
    if query_lower.starts_with("tag:") {
        let tag = query_lower.strip_prefix("tag:").unwrap();
        for node in nodes {
            if node.tags.iter().any(|t| t.to_lowercase().contains(tag)) {
                results.push(node.id);
            }
        }
    } else {
        // General search across title, URL, and tags
        for node in nodes {
            let title_match = node.title.to_lowercase().contains(&query_lower);
            let url_match = node
                .url
                .as_ref()
                .map(|u| u.to_lowercase().contains(&query_lower))
                .unwrap_or(false);
            let tag_match = node
                .tags
                .iter()
                .any(|t| t.to_lowercase().contains(&query_lower));

            if title_match || url_match || tag_match {
                results.push(node.id);
            }
        }
    }

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

    fn build_tree(
        nodes: &[BookmarkNode],
        parent_id: Option<&str>,
        html: &mut String,
    ) {
        for node in nodes {
            let node_parent = node.parent_id.as_deref();
            if node_parent == parent_id {
                if node.is_folder() {
                    html.push_str(&format!(
                        "    <DT><H3 ADD_DATE=\"{}\">{}</H3>\n",
                        node.add_date, node.title
                    ));
                    html.push_str("    <DL><p>\n");
                    build_tree(nodes, Some(&node.id), html);
                    html.push_str("    </DL><p>\n");
                } else if let Some(url) = &node.url {
                    let icon_attr = node
                        .icon
                        .as_ref()
                        .map(|i| format!(" ICON=\"{}\"", i))
                        .unwrap_or_default();
                    html.push_str(&format!(
                        "    <DT><A HREF=\"{}\" ADD_DATE=\"{}\"{}>{}</A>\n",
                        url, node.add_date, icon_attr, node.title
                    ));
                }
            }
        }
    }

    build_tree(&nodes, None, &mut html);
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

    for node in nodes {
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

    fn build_markdown(
        nodes: &[BookmarkNode],
        parent_id: Option<&str>,
        md: &mut String,
        level: usize,
    ) {
        let indent = "  ".repeat(level);

        for node in nodes {
            let node_parent = node.parent_id.as_deref();
            if node_parent == parent_id {
                if node.is_folder() {
                    md.push_str(&format!("{}## {}\n\n", indent, node.title));
                    build_markdown(nodes, Some(&node.id), md, level + 1);
                } else if let Some(url) = &node.url {
                    md.push_str(&format!("{}- [{}]({})\n", indent, node.title, url));
                }
            }
        }
    }

    build_markdown(&nodes, None, &mut md, 0);

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

    if let Some(node) = nodes.iter_mut().find(|n| n.id == node_id) {
        if let Some(title) = updates.get("title").and_then(|v| v.as_str()) {
            node.title = title.to_string();
        }
        if let Some(url) = updates.get("url").and_then(|v| v.as_str()) {
            node.url = Some(url.to_string());
        }
        node.last_modified = js_sys::Date::now() as u64;
    }

    serde_wasm_bindgen::to_value(&nodes).map_err(|e| JsValue::from_str(&e.to_string()))
}

// Delete a node
#[wasm_bindgen]
pub fn delete_node(nodes_js: JsValue, node_id: &str) -> Result<JsValue, JsValue> {
    let mut nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    nodes.retain(|n| n.id != node_id && n.parent_id.as_deref() != Some(node_id));

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

    new_node.parent_id = Some(parent_id.to_string());
    new_node.id = format!("node_{}", js_sys::Date::now() as u64);

    nodes.push(new_node);

    serde_wasm_bindgen::to_value(&nodes).map_err(|e| JsValue::from_str(&e.to_string()))
}

// Add a tag to a node
#[wasm_bindgen]
pub fn add_tag(nodes_js: JsValue, node_id: &str, tag: &str) -> Result<JsValue, JsValue> {
    let mut nodes: Vec<BookmarkNode> = serde_wasm_bindgen::from_value(nodes_js)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;

    if let Some(node) = nodes.iter_mut().find(|n| n.id == node_id) {
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

    if let Some(node) = nodes.iter_mut().find(|n| n.id == node_id) {
        node.tags.retain(|t| t != tag);
    }

    serde_wasm_bindgen::to_value(&nodes).map_err(|e| JsValue::from_str(&e.to_string()))
}
