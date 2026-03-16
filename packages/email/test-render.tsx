import { render } from "@react-email/render";
import * as React from "react";
import * as jsxRun from "react/jsx-runtime";
import * as rds from "react-dom/server";
import JoinWorkspaceTemplate from "./src/templates/join-workspace";

async function main() {
  const el = <JoinWorkspaceTemplate 
    magicLink="https://example.com/magic" 
    workspaceName="Acme Corp" 
    inviterName="Alice" 
    inviterEmail="alice@acme.com" 
    workspaceLogo={undefined} 
  />;
  const jsxEl = jsxRun.jsx('div', {});
  const rEl = React.createElement('div', {});

  console.log("test-render react_jsx_runtime path:", import.meta.resolve("react/jsx-runtime"));
  console.log("React version:", React.version);
  console.log("React.createElement $$typeof:", String(rEl.$$typeof));
  console.log("jsxRun.jsx $$typeof:", String((jsxEl as any).$$typeof));
  console.log("Equal?", rEl.$$typeof === (jsxEl as any).$$typeof);

  try {
    const rdsEsm = await import('react-dom/server').then(m => m.default || m);
    rdsEsm.renderToStaticMarkup(jsxEl);
    console.log("await import renderToStaticMarkup succeeded!");
    
    // Test with PipeableStream
    await new Promise((resolve, reject) => {
        const stream = rdsEsm.renderToPipeableStream(jsxEl, {
            onAllReady() {
                console.log("pipeable stream ready!");
                resolve(null);
            },
            onError(err: any) {
                console.log("pipeable stream error!");
                reject(err);
            }
        });
    });
  } catch (err: any) {
    console.log("await import failed:", err.message);
  }

  try {
    const html = await render(el, { pretty: true });
    console.log("Success! Rendered HTML:", html.length + " chars");
  } catch (error: any) {
    console.error("Render failed:", error.message);
  }
}
main();
