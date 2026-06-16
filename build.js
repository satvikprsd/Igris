const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

async function runBuild() {
    console.log("Copying Opening Book JSON...");
    fs.copyFileSync(
        path.join(__dirname, "src/utils/openingBook.json"),
        path.join(__dirname, "public/openingBook.json")
    );

    console.log("Bundling Web Worker...");
    await esbuild.build({
        entryPoints: ["src/worker.ts"],
        bundle: true,
        outfile: "public/worker.js",
        minify: true,
        sourcemap: true,
        platform: "browser",
        target: ["es2022"],
        external: ["fs", "path"],
    });

    console.log("Bundling Browser Engine...");
    await esbuild.build({
        entryPoints: ["src/browser.ts"],
        bundle: true,
        outfile: "public/browser-engine.js",
        minify: true,
        sourcemap: true,
        platform: "browser",
        globalName: "IgrisEngine",
        target: ["es2022"],
        external: ["fs", "path"],
    });

    console.log("Build completed successfully!");
}

runBuild().catch((err) => {
    console.error("Build failed:", err);
    process.exit(1);
});
