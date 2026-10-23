// Node 側は何もしない。loader entry として存在させ、dsh-client-modules に
// package.json の dsh.client 宣言（lib/client.js）を走査させるためだけの半身。
export const name = "dsh-mobile-ui";
export function apply() {}
