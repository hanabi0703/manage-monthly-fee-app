import Svg, { Path, Circle, Rect } from "react-native-svg";

export type DoodleIconName =
  | "pencil"
  | "members"
  | "settings"
  | "accounting"
  | "calendar"
  | "leaf"
  | "star"
  | "flower";

type Props = {
  name: DoodleIconName;
  size?: number;
  color?: string;
};

export function DoodleIcon({ name, size = 26, color = "#6E5C4C" }: Props) {
  if (name === "pencil") {
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

  if (name === "members") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="8" cy="9" r="3" stroke={color} strokeWidth="1.5" />
        <Circle cx="16" cy="9" r="3" stroke={color} strokeWidth="1.5" />
        <Path
          d="M3.5 19C4 15.5 6 14 8 14C10 14 12 15.5 12.5 19"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <Path
          d="M11.5 19C12 15.5 14 14 16 14C18 14 20 15.5 20.5 19"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </Svg>
    );
  }

  if (name === "calendar") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="4" y="5" width="16" height="15" rx="3" stroke={color} strokeWidth="1.5" />
        <Path d="M8 3V7M16 3V7M4 10H20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
    );
  }

  if (name === "accounting") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect x="5" y="3" width="14" height="18" rx="2.5" stroke={color} strokeWidth="1.5" />
        <Path d="M8 8H16M8 12H16M8 16H13" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
    );
  }

  if (name === "leaf") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M5 18C4 11 9 4.5 19 4C19 14 12.5 19 5 18Z"
          stroke={color}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <Path d="M6.5 17.5C9 14 12 10.5 17 6" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      </Svg>
    );
  }

  if (name === "star") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 3.5L14.3 9.4L20.5 9.9L15.7 13.9L17.2 20L12 16.6L6.8 20L8.3 13.9L3.5 9.9L9.7 9.4Z"
          stroke={color}
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === "flower") {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="2.3" stroke={color} strokeWidth="1.4" />
        <Path
          d="M12 4.5C13.2 5.6 13.2 7.4 12 8.6C10.8 7.4 10.8 5.6 12 4.5Z"
          stroke={color}
          strokeWidth="1.3"
        />
        <Path
          d="M12 15.4C13.2 16.5 13.2 18.3 12 19.5C10.8 18.3 10.8 16.5 12 15.4Z"
          stroke={color}
          strokeWidth="1.3"
        />
        <Path
          d="M19.5 12C18.4 13.2 16.6 13.2 15.4 12C16.6 10.8 18.4 10.8 19.5 12Z"
          stroke={color}
          strokeWidth="1.3"
        />
        <Path
          d="M8.6 12C7.4 13.2 5.6 13.2 4.5 12C5.6 10.8 7.4 10.8 8.6 12Z"
          stroke={color}
          strokeWidth="1.3"
        />
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
