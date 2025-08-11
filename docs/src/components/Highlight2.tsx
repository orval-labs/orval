import Highlight, { defaultProps } from 'prism-react-renderer';
import CodeTheme from 'prism-react-renderer/themes/nightOwl';
import * as React from 'react';
// Original: https://raw.githubusercontent.com/PrismJS/prism-themes/master/themes/prism-ghcolors.css

const theme = Object.assign({}, CodeTheme, {
  plain: {
    color: '#d6deed',
    backgroundColor: '#2b3035',
    fontFamily: `SFMono-Regular,Consolas,Liberation Mono,Menlo,Courier,monospace`,
    borderRadius: 12,
    fontSize: 14,
    lineHeight: '1.5',
  },
});

const Code = ({
  children,
  codeString,
  className = 'language-js',
  ...props
}) => {
  const language = className.replace(/language-/, '');
  return (
    <Highlight
      {...defaultProps}
      code={children.trim()}
      language={language}
      theme={theme}
    >
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={className + ' bg-gray-50 pb-4 pt-4 pr-4 overflow-scroll'}
          style={{
            ...style,
            fontSize: 13,
            lineHeight: '1.5',
          }}
        >
          {tokens.map((line, i) => {
            // Fixes React warning: 'key' must be passed directly in JSX, not via spread
            const { key: lineKey, ...lineProps } = getLineProps({
              line,
              key: i,
            });

            return (
              <div key={lineKey} {...lineProps}>
                {tokens.length > 1 ? (
                  <span
                    aria-hidden="true"
                    className="select-none text-gray-300 text-right w-5 inline-block mx-2"
                  >
                    {i + 1}
                  </span>
                ) : (
                  <span className="mx-2 w-5" />
                )}
                {line.map((token, j) => {
                  const { key: tokenKey, ...tokenProps } = getTokenProps({
                    token,
                    key: j,
                  });
                  return <span key={tokenKey} {...tokenProps} />;
                })}
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
};

export default Code;
