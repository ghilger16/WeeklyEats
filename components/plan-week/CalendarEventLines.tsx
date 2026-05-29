import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme, alpha } from "../../styles/theme";

export type CalendarEventLine = {
  id: string;
  title: string;
  timeLabel: string;
};

type CalendarEventLinesProps = {
  events: CalendarEventLine[];
};

const CalendarEventLines = ({ events }: CalendarEventLinesProps) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!events.length) {
    return null;
  }

  return (
    <View style={styles.eventTree}>
      {events.map((event) => (
        <View key={event.id} style={styles.eventRow}>
          <View style={styles.eventBranch} />
          <Text style={styles.eventText} numberOfLines={1} ellipsizeMode="tail">
            {event.title} • {event.timeLabel}
          </Text>
        </View>
      ))}
    </View>
  );
};

export default CalendarEventLines;

const createStyles = (theme: WeeklyTheme) => {
  const treeGuideColor = alpha(
    theme.color.subtleInk,
    theme.mode === "dark" ? 0.5 : 0.4,
  );

  return StyleSheet.create({
    eventTree: {
      marginLeft: theme.space.sm,
      paddingLeft: theme.space.sm,
      borderLeftWidth: 1,
      borderLeftColor: treeGuideColor,
      gap: 3,
    },
    eventRow: {
      minHeight: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
    },
    eventBranch: {
      width: 10,
      borderBottomWidth: 1,
      borderBottomColor: treeGuideColor,
    },
    eventText: {
      flex: 1,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      letterSpacing: 0,
    },
  });
};
