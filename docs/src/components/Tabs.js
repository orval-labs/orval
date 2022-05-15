import * as React from 'react';

const STYLES_TAB_CONTENT = {
  padding: '10px 20px',
};

const STYLES_TAB_LIST = {
  borderBottom: '1px solid #ccc',
  paddingLeft: 0,
};

const STYLES_TAB_LIST_ITEM = {
  display: 'inline-block',
 'listStyle': 'none',
  marginBottom: '-1px',
  padding: '10px 15px',
};

const STYLES_TAB_LIST_ACTIVE = {
  backgroundColor: 'white',
  border: 'solid #ccc',
  borderBottom: '0px',
  borderWidth: '1px 1px 0 1px',
    background: '#F0F1F2',
  borderRadius: '4px',
};

const TabButton = ({ activeTab, label, onClick }) => {
  const handleClick = () => onClick(label);

  let styles = STYLES_TAB_LIST_ITEM;
  if (activeTab === label) {
    styles = {...styles, ...STYLES_TAB_LIST_ACTIVE}
  }

  return (
    <li style={styles} onClick={handleClick}>
      {label}
    </li>
  );
};

/**
 * Dummy emelent, needed for `<Tabs/>` component to work properly
 */
export const Tab = ({ children }) => children;

/**
 * @example
 * <Tabs>
 *   <Tab label="Tab1">Tab 1 content...</Tab>
 *   <Tab label="Tab2">Tab 2 content...</Tab>
 * </Tabs>
 */
export const Tabs = ({ children }) => {
  const [activeTab, setActiveTab] = React.useState(children[0].props.label);

  return (
    <div>
      <ol style={STYLES_TAB_LIST}>
        {children.map((child) => {
          const { label } = child.props;
          return (
            <TabButton
              activeTab={activeTab}
              key={label}
              label={label}
              onClick={setActiveTab}
            />
          );
        })}
      </ol>
      <div style={STYLES_TAB_CONTENT}>
        {children.map((child) => {
          if (child.props.label !== activeTab) {
            return;
          }
          return child.props.children;
        })}
      </div>
    </div>
  );
};
