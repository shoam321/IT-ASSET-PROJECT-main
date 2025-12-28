fn main() {
    // Ensure the desktop binary is rebuilt when the frontend bundle changes.
    // Otherwise, updating `../dist` may not trigger a new embedded asset bundle.
    println!("cargo:rerun-if-changed=../dist");
    println!("cargo:rerun-if-changed=../dist/index.html");
    println!("cargo:rerun-if-changed=../dist/assets");
    tauri_build::build()
}
