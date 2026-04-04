import reactConfig from "@repo/eslint-config/react.js";
import tseslint from "typescript-eslint";

export default tseslint.config({ ignores: ["dist"] }, reactConfig);
