import path from "path";
import fs from "fs";
import ProvidersClient from "./ProvidersClient";

export default async function Home() {
  const providersDir = path.join(process.cwd(), "providers");
  const files = fs.readdirSync(providersDir);
  const providers = files
    .filter((file) => file.endsWith(".json"))
    .map((file) => {
      const content = fs.readFileSync(path.join(providersDir, file), "utf-8");
      return JSON.parse(content);
    });
  return <ProvidersClient providers={providers} />;
}
