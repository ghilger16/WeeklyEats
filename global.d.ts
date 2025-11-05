declare module "expo-router/entry";

declare module "react-native-gesture-handler" {
  import * as React from "react";
  import {
    ViewProps,
    StyleProp,
    ViewStyle,
    GestureResponderEvent,
  } from "react-native";

  export interface GestureHandlerRootViewProps extends ViewProps {}
  export const GestureHandlerRootView: React.ComponentType<GestureHandlerRootViewProps>;

  export interface RectButtonProps extends ViewProps {
    rippleColor?: string;
    style?: StyleProp<ViewStyle>;
    onPress?: (event: GestureResponderEvent) => void;
  }
  export const RectButton: React.ComponentType<RectButtonProps>;

  export interface SwipeableProps extends ViewProps {
    children?: React.ReactNode;
    friction?: number;
    leftThreshold?: number;
    rightThreshold?: number;
    renderLeftActions?: () => React.ReactNode;
    renderRightActions?: () => React.ReactNode;
    onSwipeableOpen?: (direction: "left" | "right") => void;
    onSwipeableClose?: (direction: "left" | "right") => void;
  }

  export class Swipeable extends React.Component<SwipeableProps> {
    close(): void;
    openLeft(): void;
    openRight(): void;
  }
}

declare module "@react-native-community/datetimepicker" {
  import * as React from "react";
  import { ViewProps } from "react-native";

  export interface DateTimePickerEvent {
    type: "set" | "dismissed";
    nativeEvent: {
      timestamp: number;
    };
  }

  export interface DateTimePickerProps extends ViewProps {
    mode?: "date" | "time" | "datetime";
    display?: "default" | "spinner" | "calendar" | "clock";
    value: Date;
    onChange?: (event: DateTimePickerEvent, date?: Date) => void;
  }

  const DateTimePicker: React.ComponentType<DateTimePickerProps>;
  export default DateTimePicker;
}
