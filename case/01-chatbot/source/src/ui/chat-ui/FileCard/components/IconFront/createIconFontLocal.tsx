import Icon from 'antd-icons6';
import React from 'react';

const scopeKeyMap: Record<string, boolean> = {};

export interface IconBaseProps extends React.HTMLProps<HTMLSpanElement> {
  spin?: boolean;
  rotate?: number;
}

export interface IconFontProps<T extends string = string>
  extends IconBaseProps {
  type: T;
}

function generateScopeId() {
  let id;
  do {
    id = Math.random().toString(36).substring(2, 8);
  } while (scopeKeyMap[id]);
  scopeKeyMap[id] = true;
  return `a-${id}`;
}

let customCache = new Set<string>();
function isValidCustomScriptUrl(scriptUrl: string): boolean {
  return Boolean(
    typeof scriptUrl === 'string' &&
      scriptUrl.length &&
      !customCache.has(scriptUrl),
  );
}

async function createScriptUrlElements(
  scriptUrls: string[],
  replacement?: (content: string) => string,
  index = 0,
) {
  const currentScriptUrl = scriptUrls[index];
  if (isValidCustomScriptUrl(currentScriptUrl)) {
    try {
      const response = await fetch(currentScriptUrl);
      let scriptContent = await response.text();

      // Apply replacement function if provided
      if (replacement) {
        scriptContent = replacement(scriptContent);
      }

      const script = document.createElement('script');
      script.text = scriptContent;
      script.setAttribute('data-namespace', currentScriptUrl);
      document.body.appendChild(script);

      customCache.add(currentScriptUrl);

      if (scriptUrls.length > index + 1) {
        await createScriptUrlElements(scriptUrls, replacement, index + 1);
      }
    } catch (error) {
      console.error(`Failed to load script: ${currentScriptUrl}`, error);
      if (scriptUrls.length > index + 1) {
        await createScriptUrlElements(scriptUrls, replacement, index + 1);
      }
    }
  }
}

const loadScript = (
  scriptUrl?: string | string[],
  replacement?: (content: string) => string,
) => {
  if (
    scriptUrl &&
    typeof document !== 'undefined' &&
    typeof window !== 'undefined' &&
    typeof document.createElement === 'function'
  ) {
    if (Array.isArray(scriptUrl)) {
      // Load in reverse order to ensure later items take precedence
      createScriptUrlElements(scriptUrl.reverse(), replacement);
    } else {
      createScriptUrlElements([scriptUrl], replacement);
    }
  }
};

interface CreateIconFontOptions {
  /**
   * 是否启用作用域隔离，默认：开
   */
  scope?: boolean;
  scriptUrl: string[];
}

export const createIconFontLocal = ({
  scope = true,
  scriptUrl,
}: CreateIconFontOptions) => {
  const scopeId = scope ? generateScopeId() : '';

  const getRealSymbolId = (name: string) => {
    if (scopeId) {
      return `${scopeId}-${name}`;
    } else {
      return name;
    }
  };

  /**
   * 使用 scopeId 替换 script 中的 id
   */
  const scriptReplacement = (scriptText: string) => {
    if (scope) {
      return scriptText.replace(
        /symbol id="([^"]+)"/g,
        `symbol id="${scopeId}-$1"`,
      );
    }
    return scriptText;
  };

  // 加载script 脚本
  loadScript(scriptUrl, scriptReplacement);

  const IconFont = React.forwardRef<HTMLSpanElement, IconFontProps>(
    (props, ref) => {
      const { type, children, ...restProps } = props;

      let content = null;
      if (type) {
        content = <use xlinkHref={`#${getRealSymbolId(type)}`} />;
      }
      if (children) {
        content = children;
      }

      return (
        <Icon {...restProps} ref={ref}>
          {content}
        </Icon>
      );
    },
  );

  IconFont.displayName = 'IconFont';
  return IconFont;
};
