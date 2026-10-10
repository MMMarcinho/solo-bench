import cls from 'classnames';
import React from 'react';
import { PrismAsyncLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import oneLight from 'react-syntax-highlighter/dist/esm/styles/prism/one-light';
import { CLASS_PREFIX } from '../constants';
import {
  CODE_HIGHLIGHTER_STYLE,
  normalizeCodeLanguage,
} from '../constants/file';
import './index.less';

const classPrefix = `${CLASS_PREFIX}-code-block`;
/** 行号颜色，对齐 VSCode 默认主题的行号色 */
const LINE_NUMBER_STYLE: React.CSSProperties = { color: '#858585' };
const NON_SCROLLABLE_CODE_HIGHLIGHTER_STYLE: React.CSSProperties = {
  ...CODE_HIGHLIGHTER_STYLE,
  overflow: 'visible',
};

/**
 * 将 React 子节点转换为代码字符串，兼容字符串、数字和嵌套元素。
 */
function getTextFromChildren(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return String(child);
      }

      if (React.isValidElement(child)) {
        return getTextFromChildren(child.props.children);
      }

      return '';
    })
    .join('');
}

export interface ICodeBlockProps {
  /** 是否以块级代码形式展示。 */
  block?: boolean;
  /** 代码内容。 */
  children?: React.ReactNode;
  /** 自定义类名。 */
  className?: string;
  /** 代码语言、文件名或扩展名。 */
  lang?: string;
  /** 是否跳过语法高亮，以纯文本方式渲染。 */
  plainText?: boolean;
  /** 是否显示代码行号。 */
  showLineNumbers?: boolean;
  /** 是否由代码块自身承载滚动。 */
  scrollable?: boolean;
  /** 流式代码块状态。 */
  streamStatus?: 'loading' | 'done';
}

type BlockCodeProps = Omit<ICodeBlockProps, 'block'>;

/**
 * 渲染带语法高亮的块级代码。
 */
const BlockCode: React.FC<BlockCodeProps> = ({
  children,
  className,
  lang,
  plainText,
  showLineNumbers,
  scrollable = true,
  streamStatus,
}) => {
  const code = React.useMemo(
    () => getTextFromChildren(children).replace(/\n$/, ''),
    [children],
  );
  const language = React.useMemo(() => normalizeCodeLanguage(lang), [lang]);

  if (plainText || streamStatus === 'loading') {
    return (
      <code
        className={cls(classPrefix, className)}
        data-lang={language || undefined}
      >
        {code}
      </code>
    );
  }

  return (
    <SyntaxHighlighter
      className={cls(classPrefix, className)}
      codeTagProps={{
        className: language ? `language-${language}` : undefined,
      }}
      CodeTag="span"
      customStyle={
        scrollable
          ? CODE_HIGHLIGHTER_STYLE
          : NON_SCROLLABLE_CODE_HIGHLIGHTER_STYLE
      }
      data-lang={language || undefined}
      language={language || 'text'}
      lineNumberStyle={LINE_NUMBER_STYLE}
      PreTag="code"
      showInlineLineNumbers={false}
      showLineNumbers={showLineNumbers}
      style={oneLight}
    >
      {code}
    </SyntaxHighlighter>
  );
};

/**
 * 根据 block 属性渲染行内代码或带语法高亮的块级代码。
 */
export const CodeBlock = React.memo(function CodeBlock({
  block = true,
  ...props
}: ICodeBlockProps) {
  if (!block) {
    return <code className={props.className}>{props.children}</code>;
  }

  return <BlockCode {...props} />;
});
