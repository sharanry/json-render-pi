import type { Preview } from "@storybook/html-vite";
import "../stories/storybook.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    backgrounds: { disable: true },
    controls: { expanded: true },
  },
};

export default preview;
