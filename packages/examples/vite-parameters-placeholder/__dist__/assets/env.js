const l=/(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;function o(s){const n={};let e=s.toString();e=e.replace(/\r\n?/mg,`
`);let t;for(;(t=l.exec(e))!=null;){const r=t[1];let x=t[2]||"";x=x.trim();const c=x[0];x=x.replace(/^(['"])([\s\S]+)\1$/mg,"$2"),c==='"'&&(x=x.replace(/\\n/g,`
`),x=x.replace(/\\r/g,"\r")),n[r]=x}return n}const a=o(`VITE_NAME=vite-plugin-dotenv
`);var i=Object.assign(a,{BASE_URL:"/",MODE:"production",DEV:!1,PROD:!0});export{i as v};
