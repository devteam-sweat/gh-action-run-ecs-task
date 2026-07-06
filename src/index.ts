/**
 * The entrypoint for the action. This file simply imports and runs the action's
 * main logic. Keeping the invocation here (separate from main.ts) means importing
 * the logic in tests does not trigger execution, and avoids the `require.main ===
 * module` idiom, which does not survive ncc bundling of ESM-source modules.
 */
import { run } from './main'

run()
