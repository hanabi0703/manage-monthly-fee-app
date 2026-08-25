import React from 'react';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

type IconName = 'pencil' | 'members' | 'settings' | 'accounting' | 'calendar';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

export function DoodleIcon({
  name,
  size = 26,
  color = '#6E5C4C',
}: Props) {
  if (name === 'pencil') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 18L6 14L16 4C17 3 18 4 19 5C20 6 20 7 19 8L9 18L5 19Z"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path d="M7 14L10 17" stroke="#F6D980" strokeWidth="2" strokeLinecap="round" />
      </Svg>
    );
  }

  if (name === 'members') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="8" cy="9" r="3" stroke={color} strokeWidth="1.5" />
        <Circle cx="16" cy="9" r="3" stroke={color} strokeWidth="1.5" />
        <Path d="M3.5 19C4 15.5 6 14 8 14C10 14 12 15.5 12.5 19" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <Path d="M11.5 19C12 15.5 14 14 16 14C18 14 20 15.5 20.5 19" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
    );
  }

  if (name === 'calendar') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="4" y="5" width="16" height="15" rx="3" stroke={color} strokeWidth="1.5" />
        <Path d="M8 3V7M16 3V7M4 10H20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
    );
  }

  if (name === 'accounting') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="5" y="3" width="14" height="18" rx="2.5" stroke={color} strokeWidth="1.5" />
        <Path d="M8 8H16M8 12H16M8 16H13" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth="1.5" />
      <Path
        d="M12 3.5V6M12 18V20.5M3.5 12H6M18 12H20.5M5.8 5.8L7.5 7.5M16.5 16.5L18.2 18.2M18.2 5.8L16.5 7.5M7.5 16.5L5.8 18.2"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <Path d="M17.2 3.8C18.5 4.2 19.6 5.2 20 6.5" stroke="#91BD72" strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  );
}
