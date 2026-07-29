import type { StorybookConfig } from "@storybook/html-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.ts"],
  framework: "@storybook/html-vite",
  docs: { autodocs: true },
};

export default config;
