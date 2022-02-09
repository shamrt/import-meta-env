import path from "path";
import { Plugin, ResolvedConfig } from "vite";
import colors from "picocolors";
import { writeFileSync } from "fs";
import { parseSnippet } from "./parse";
import { verifySnippet } from "./verify";
import { version } from "../package.json";

const defaultPlaceholder = "__env__";
const preservedEnvKeys = ["BASE_URL", "MODE", "DEV", "PROD"];
const inlineEnvKeys = ["SSR", "LEGACY"];
const unique = (() => {
  const uniqueId = "vite_plugin_dotenv_unique_id_";
  return (
    uniqueId +
    Array(256 - uniqueId.length)
      .fill("x")
      .join("")
  );
})();

const createPlugin: ({
  placeholder,
  verify,
  debug,
}?: {
  /**
   * The placeholder to replace with the `.env` file content
   *
   * @default "__env__"
   */
  placeholder?: string;

  /**
   * Whether to verify the `.env` file content at runtime
   *
   * @default true
   */
  verify?: boolean;

  /**
   * Whether to dump debug logs
   * Logs will be dumped to <package-root>/vite-plugin-dotenv-debug.log
   *
   * @default false
   */
  debug?: boolean;
}) => Plugin[] = (pluginOptions = {}) => {
  let debugLog = "";

  let config: ResolvedConfig;
  let envKeys: Set<string>;

  const virtualFile = "env";
  const virtualId = "\0" + virtualFile;
  const placeholder = pluginOptions.placeholder || defaultPlaceholder;

  const pre = <Plugin>{
    name: "dotenv:pre",
    enforce: "pre",
    apply: (_, env) => {
      return env.command === "build";
    },
    config(userConfig) {
      return {
        build: {
          rollupOptions: {
            output: {
              manualChunks: {
                [virtualFile]: [virtualId],
              },
              chunkFileNames(chunkInfo) {
                if (chunkInfo.name === virtualFile) {
                  return path.join(config.build.assetsDir, `[name].js`);
                }

                const output = (() => {
                  const output = userConfig.build?.rollupOptions?.output;
                  if (Array.isArray(output)) {
                    return output;
                  } else if (typeof output === "object") {
                    return [output];
                  } else {
                    return [];
                  }
                })();
                const chunkFileNamesList = output.map((o) => o.chunkFileNames);
                for (const chunkFileNames of chunkFileNamesList) {
                  if (typeof chunkFileNames === "string") {
                    return chunkFileNames;
                  } else if (typeof chunkFileNames === "function") {
                    return chunkFileNames(chunkInfo);
                  }
                }
                return path.join(config.build.assetsDir, `[name].[hash].js`);
              },
            },
          },
        },
      };
    },
    configResolved(_config) {
      config = _config;

      envKeys = new Set([]);
      for (const key of Object.keys(config.env)) {
        envKeys.add(key);
      }
    },
    resolveId(id, _, options) {
      if (options.ssr) {
        throw new Error(`vite-plugin-dotenv: SSR is not supported.`);
      }

      if (id === virtualFile) {
        return virtualId;
      }

      if (id === virtualId) {
        return virtualId;
      }
    },
    load(id) {
      if (id === virtualId) {
        const preservedEnv = preservedEnvKeys.reduce((acc, key) => {
          return Object.assign(acc, { [key]: config.env[key] });
        }, {});
        return [
          parseSnippet,
          `const e = parse(${placeholder}, {});`,
          ...(pluginOptions.verify ?? true
            ? [
                verifySnippet(
                  JSON.stringify(
                    [...envKeys.keys()]
                      .filter(
                        (key) =>
                          !preservedEnvKeys.includes(key) &&
                          !inlineEnvKeys.includes(key)
                      )
                      .reduce(
                        (acc, key) =>
                          Object.assign(acc, { [key]: config.env[key] }),
                        {}
                      )
                  )
                ),
                `verify(e);`,
              ]
            : []),
          `export default Object.assign(e, ${JSON.stringify(preservedEnv)});`,
        ].join("\n");
      }
    },
    transform(code, id) {
      if (id !== virtualId && id.includes("node_modules") === false) {
        if (isTransformingJs(code, id)) {
          debugLog += `\n===before transforming [.jt]sx? ${id}===\n` + code;

          code =
            `import ${unique} from '${virtualFile}';\n` +
            code.replace(`import ${unique} from '${virtualFile}';\n`, "");

          debugLog +=
            `\n===after transforming [.jt]sx? ${id}===\n` +
            code +
            "\n===vite-plugin-dotenv===\n";
        } else if (isTransformingVue(code, id)) {
          debugLog += `\n===before transforming vue ${id}===\n` + code;

          code = code.replace(
            /(\<script.*?\>)/,
            `$1\nimport ${unique} from '${virtualFile}';`
          );

          debugLog +=
            `\n===after transforming vue ${id}===\n` +
            code +
            "\n===vite-plugin-dotenv===\n";
        }

        inlineEnvKeys.forEach((key) => {
          code = code.replace(
            new RegExp(`import.meta.env.${key}`, "g"),
            unique + `.${key}`
          );
        });

        code = code.replace(/import\.meta\.env/g, unique);

        inlineEnvKeys.forEach((key) => {
          code = code.replace(
            new RegExp(unique + `.${key}`, "g"),
            `import.meta.env.${key}`
          );
        });
      }
      return code;
    },
    transformIndexHtml(html) {
      html = html.replace(new RegExp(unique, "g"), "import.meta.env");
      return html;
    },
    closeBundle() {
      if (pluginOptions.debug) {
        writeFileSync(
          path.join(config.root, "vite-plugin-dotenv-debug.log"),
          debugLog
        );
      }

      config.logger.info(
        [
          "",
          `${colors.cyan("vite-plugin-dotenv v" + version)}`,
          `${colors.green("✓")} environment files are generated.`,
          colors.yellow(
            `Remember to inject environment variables before serving your application.`
          ),
          "",
        ].join("\n")
      );
    },
  };

  return [pre];
};

export default createPlugin;

const isTransformingJs = (code: string, id: string) =>
  [".js", ".ts", ".jsx", ".tsx"].some((ext) => id.endsWith(ext)) &&
  id.includes("?vue&type=template") === false;

const isTransformingVue = (code: string, id: string) => id.endsWith(".vue");
