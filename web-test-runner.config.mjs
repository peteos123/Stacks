import { fromRollup } from "@web/dev-server-rollup";
import { esbuildPlugin } from "@web/dev-server-esbuild";
import _postcss from "rollup-plugin-postcss";
import _replace from "@rollup/plugin-replace";
import _commonjs from "@rollup/plugin-commonjs";
import { playwrightLauncher } from "@web/test-runner-playwright";
import { visualRegressionPlugin } from "@web/test-runner-visual-regression/plugin";

const ignoredBrowserLogs = [
    "Lit is in dev mode. Not recommended for production! See https://lit.dev/msg/dev-mode for more information.",
];

// disable CSS animation snippet
// taken from https://github.com/microsoft/playwright/issues/7548#issuecomment-881897256
const testRunnerHtml = (testFramework) =>
`<!DOCTYPE html><html>
    <body>
        <style>
            *,
            *::before,
            *::after {
                -moz-animation: none !important;
                -moz-transition: none !important;
                animation: none !important;
                caret-color: transparent !important;
                transition: none !important;
            }
        </style>
        <script type="module" src="${testFramework}"></script>
    </body>
</html>`;


const postcss = fromRollup(_postcss);
const replace = fromRollup(_replace);
const commonjs = fromRollup(_commonjs);

export default {
    concurrentBrowsers: 3,
    browsers: [
        playwrightLauncher({
            product: "chromium",
            createBrowserContext({ browser }) {
                return browser.newContext({ reducedMotion: "reduce" });
            },
        }),
        playwrightLauncher({
            product: "firefox",
            createBrowserContext({ browser }) {
                return browser.newContext({ reducedMotion: "reduce" });
            },
            launchOptions: {
                firefoxUserPrefs: {
                    // force pointer capabilities activation on Firefox Headless on GTK (Gnome Toolkit - CI)
                    // see https://github.com/microsoft/playwright/issues/7769#issuecomment-966098074
                    "ui.primaryPointerCapabilities": 0x02 | 0x04,
                    "ui.allPointerCapabilities": 0x02 | 0x04,
                },
            },
        }),
        playwrightLauncher({
            product: "webkit",
            createBrowserContext({ browser }) {
                return browser.newContext({ reducedMotion: "reduce" });
            },
        }),
    ],
    testFramework: {
        config: {
            timeout: "10000",
        },
    },
    nodeResolve: { browser: true },
    mimeTypes: {
        "**/*.less": "js",
    },
    plugins: [
        postcss(),
        replace({
            "process.env.NODE_ENV": JSON.stringify("production"),
            "preventAssignment": true,
        }),
        commonjs(),
        esbuildPlugin({ ts: true }),
        visualRegressionPlugin({
            // https://github.com/StackExchange/Stacks?tab=readme-ov-file#visual-regression-tests
            // we are creating screenshots with a .ico extension instead of .png to
            // bypass an issue with netlify not honoring the GIT_LFS_FETCH_INCLUDE
            // env variable and timing out trying to pull all the screenshots on git checkouts
            // see https://stackoverflow.atlassian.net/browse/STACKS-691
            getFailedName: ({ browser, name }) => {
                return `${browser}/baseline/${name}.ico`;
            },
            getBaselineName: ({ browser, name }) => {
                return `${browser}/baseline/${name}.ico`;
            }
        }),
    ],
    filterBrowserLogs: ({ args }) =>
        !args.some((arg) => ignoredBrowserLogs.includes(arg)),
    groups: [
        {
            name: "a11y",
            files: "lib/**/*.a11y.test.ts",
            browsers: [playwrightLauncher({ product: "chromium" })],
            testRunnerHtml
        },
        {
            name: "unit",
            files: "lib/**/!(*.visual|*.a11y|*.less).test.ts",
        },
        {
            name: "visual",
            files: "lib/**/*.visual.test.ts",
            testRunnerHtml
        },
    ],
    testsFinishTimeout: 60 * 1000 * 5, // 5 minutes
};

