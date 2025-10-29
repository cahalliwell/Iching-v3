import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  Share,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DefaultTheme,
  NavigationContainer,
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFonts as useMarcellus,
  Marcellus_400Regular,
} from "@expo-google-fonts/marcellus";
import {
  useFonts as useLora,
  Lora_400Regular,
  Lora_600SemiBold,
} from "@expo-google-fonts/lora";
import Svg, {
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  LinearGradient as SvgLinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Stop,
  Text as SvgText,
  Circle as SvgCircle,
} from "react-native-svg";
import { PieChart, BarChart, Grid, XAxis } from "react-native-svg-charts";
import { createClient } from "@supabase/supabase-js";

// 🎨 Design tokens
const palette = {
  parchmentA: "#FAF7ED",
  parchmentB: "#F3E2C0",
  parchmentGold: "#F7E4B0",
  card: "#F5E9D4",
  gold: "#D4AF37",
  goldLight: "#F8E8B5",
  goldDeep: "#B08B31",
  ink: "#2E261B",
  inkMuted: "#7A736A",
  border: "#E7D7BC",
  white: "#FFFFFF",
};

const theme = {
  colors: palette,
  radius: 22,
  space: (n) => 8 * n,
};

const fonts = {
  title: "Marcellus_400Regular",
  body: "Lora_400Regular",
  bodyBold: "Lora_600SemiBold",
};

// Some legacy call sites still expect a globally available Circle element from
// react-native-svg. Expo Snack caches aggressively, so we expose the alias to
// avoid ReferenceError crashes when the bundle hasn't refreshed fully.
const ensureLegacyCircle = (maybeCircle) => {
  const fallback = maybeCircle || ((props) => null);
  const globalRef =
    typeof globalThis !== "undefined"
      ? globalThis
      : typeof global !== "undefined"
      ? global
      : typeof window !== "undefined"
      ? window
      : typeof self !== "undefined"
      ? self
      : null;

  if (globalRef && !globalRef.Circle) {
    globalRef.Circle = fallback;
  }

  return fallback;
};

ensureLegacyCircle(SvgCircle);

const screenTopPadding = Platform.select({
  ios: theme.space(1.5),
  android: theme.space(2),
  default: theme.space(1.5),
});

const createLocalId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// 🔗 Supabase client
export const SUPABASE_URL = "https://cvowwctcpepbctokktpn.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2b3d3Y3RjcGVwYmN0b2trdHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MTYyMjIsImV4cCI6MjA3NjI5MjIyMn0.eOJ1Y7c5aBtf64sEXnO1G7z3YQAOhJNUqPfuLcjdNFw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// 📜 Hexagram data helpers
const SHEET_URL =
  "https://opensheet.elk.sh/1IYLzxYHomdVern98otj9Ff4C31qiJwK2S65tHMIJIC0/Sheet1";

const clean = (value) => (value == null ? "" : String(value).trim());

export const normalizeHexagramRow = (row) => {
  const map = {};
  Object.keys(row || {}).forEach((key) => {
    const normalized = String(key)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
    map[normalized] = row[key];
  });
  const changingLines = [
    map.cl1 || map.cl_1 || map["changing_line_1"] || "",
    map.cl2 || map.cl_2 || map["changing_line_2"] || "",
    map.cl3 || map.cl_3 || map["changing_line_3"] || "",
    map.cl4 || map.cl_4 || map["changing_line_4"] || "",
    map.cl5 || map.cl_5 || map["changing_line_5"] || "",
    map.cl6 || map.cl_6 || map["changing_line_6"] || "",
  ].map(clean);

  return {
    number: parseInt(map.number || map.no || map.hexagram || "0", 10) || null,
    name: clean(map.name || map.title),
    nature: clean(map.nature || map.trigrams || map.image),
    essence: clean(map.essence || map.judgment || map.judgement || map.meaning),
    description: clean(
      map.description ||
        map.summary ||
        map.overview ||
        map.image_text ||
        map["image:_text"] ||
        map.imagetext
    ),
    imageUrl: clean(map.image || map.image_url || map["image url"]) || null,
    linesBinary: (map.lines || "")
      .replace(/⚊/g, "1")
      .replace(/⚋/g, "0")
      .trim(),
    changingLines,
    judgment: clean(map.judgment || map.judgement || map.meaning || map.essence),
    imageText: clean(
      map.image_text || map["image:_text"] || map.imagetext || map.description
    ),
    _raw: row,
  };
};

export async function loadHexagrams() {
  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) {
      throw new Error(`Sheet request failed: ${response.status}`);
    }
    const json = await response.json();
    return (json || [])
      .map(normalizeHexagramRow)
      .filter((item) => item.name)
      .sort((a, b) => {
        const aNum = a.number ?? Infinity;
        const bNum = b.number ?? Infinity;
        return aNum - bNum;
      });
  } catch (error) {
    console.log("Error loading sheet:", error?.message || error);
    return [];
  }
}

export function getHexagramNameByNumber(hexagrams, number) {
  if (!Array.isArray(hexagrams)) return null;
  const match = hexagrams.find((item) => item.number === number);
  return match ? match.name : null;
}

// 📈 Insights hooks
const MOCK_SUMMARY = {
  total_readings: 0,
  distinct_hexagrams: 0,
  most_drawn_hexagram: null,
};

function useInsightsSummary() {
  const [data, setData] = useState(MOCK_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setData(MOCK_SUMMARY);
        setLoading(false);
        return;
      }

      const { data: rows, error: queryError } = await supabase
        .from("insights_summary")
        .select("total_readings, distinct_hexagrams, most_drawn_hexagram")
        .eq("user_id", user.id)
        .maybeSingle();
      if (queryError) throw queryError;

      setData(
        rows || {
          total_readings: 0,
          distinct_hexagrams: 0,
          most_drawn_hexagram: null,
        }
      );
    } catch (err) {
      console.log("Insights summary error:", err?.message || err);
      setError(err);
      setData(MOCK_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { data, loading, error, refetch: fetchSummary };
}

const MOCK_COUNTS = {
  readings_today: 0,
  readings_week: 0,
  readings_month: 0,
  readings_year: 0,
  readings_total: 0,
};

function useInsightsCounts() {
  const [data, setData] = useState(MOCK_COUNTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setData(MOCK_COUNTS);
        setLoading(false);
        return;
      }

      const { data: rows, error: queryError } = await supabase
        .from("insights_counts")
        .select(
          "readings_today, readings_week, readings_month, readings_year, readings_total"
        )
        .eq("user_id", user.id)
        .maybeSingle();
      if (queryError) throw queryError;
      setData(rows || MOCK_COUNTS);
    } catch (err) {
      console.log("Insights counts error:", err?.message || err);
      setError(err);
      setData(MOCK_COUNTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return { data, loading, error, refetch: fetchCounts };
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_KEYS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const MOCK_WEEKLY = WEEKDAYS.map((weekday) => ({ weekday, readings: 0 }));
const MOCK_MONTHLY = MONTH_KEYS.map((month) => ({ month, readings: 0 }));
const MOCK_TOP_CASTS = [];

function useInsightsWeekly() {
  const [data, setData] = useState(MOCK_WEEKLY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchWeekly = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setData(MOCK_WEEKLY);
        setLoading(false);
        return;
      }

      const { data: rows, error: queryError } = await supabase
        .from("insights_weekly")
        .select("weekday, readings")
        .eq("user_id", user.id);
      if (queryError) throw queryError;

      const map = new Map((rows || []).map((item) => [item.weekday, item.readings]));
      const normalized = WEEKDAYS.map((weekday) => ({
        weekday,
        readings: Number(map.get(weekday)) || 0,
      }));
      setData(normalized);
    } catch (err) {
      console.log("Insights weekly error:", err?.message || err);
      setError(err);
      setData(MOCK_WEEKLY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeekly();
  }, [fetchWeekly]);

  return { data, loading, error, refetch: fetchWeekly };
}

function useInsightsMonthly() {
  const [data, setData] = useState(MOCK_MONTHLY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMonthly = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setData(MOCK_MONTHLY);
        setLoading(false);
        return;
      }

      const { data: rows, error: queryError } = await supabase
        .from("insights_monthly")
        .select("month, readings")
        .eq("user_id", user.id);
      if (queryError) throw queryError;

      const map = new Map((rows || []).map((item) => [item.month, item.readings]));
      const normalized = MONTH_KEYS.map((month) => ({
        month,
        readings: Number(map.get(month)) || 0,
      }));
      setData(normalized);
    } catch (err) {
      console.log("Insights monthly error:", err?.message || err);
      setError(err);
      setData(MOCK_MONTHLY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonthly();
  }, [fetchMonthly]);

  return { data, loading, error, refetch: fetchMonthly };
}

function useInsightsTopCasts() {
  const [data, setData] = useState(MOCK_TOP_CASTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTopCasts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setData(MOCK_TOP_CASTS);
        setLoading(false);
        return;
      }

      const { data: rows, error: queryError } = await supabase
        .from("insights_top5_casts")
        .select("hexagram_primary, total_casts")
        .eq("user_id", user.id)
        .order("total_casts", { ascending: false });
      if (queryError) throw queryError;

      let result = rows || [];

      if (!result?.length || result.length < 5) {
        const { data: fallbackRows, error: fallbackError } = await supabase
          .from("JournalEntries")
          .select("hexagram_primary")
          .eq("user_id", user.id);

        if (fallbackError) {
          console.log(
            "Insights top casts fallback error:",
            fallbackError?.message || fallbackError
          );
        } else if (fallbackRows?.length) {
          const countsMap = new Map();
          fallbackRows.forEach((row) => {
            const key =
              row?.hexagram_primary != null
                ? Number(row.hexagram_primary)
                : null;
            if (key == null || Number.isNaN(key)) return;
            countsMap.set(key, (countsMap.get(key) || 0) + 1);
          });

          const computed = Array.from(countsMap.entries())
            .map(([hex, count]) => ({
              hexagram_primary: hex,
              total_casts: count,
            }))
            .sort((a, b) => (b.total_casts || 0) - (a.total_casts || 0))
            .slice(0, 5);

          if (computed.length) {
            result = computed;
          }
        }
      }

      setData(result);
    } catch (err) {
      console.log("Insights top casts error:", err?.message || err);
      setError(err);
      setData(MOCK_TOP_CASTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopCasts();
  }, [fetchTopCasts]);

  return { data, loading, error, refetch: fetchTopCasts };
}

const MOCK_BALANCE = {
  yin_percent: 50,
  yang_percent: 50,
};

function useInsightsBalance() {
  const [data, setData] = useState(MOCK_BALANCE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setData(MOCK_BALANCE);
        setLoading(false);
        return;
      }

      const { data: rows, error: queryError } = await supabase
        .from("insights_balance")
        .select("yin_percent, yang_percent")
        .eq("user_id", user.id)
        .maybeSingle();
      if (queryError) throw queryError;
      setData(rows || MOCK_BALANCE);
    } catch (err) {
      console.log("Insights balance error:", err?.message || err);
      setError(err);
      setData(MOCK_BALANCE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { data, loading, error, refetch: fetchBalance };
}

const MOCK_STREAK = 0;

function useReadingStreak() {
  const [data, setData] = useState(MOCK_STREAK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStreak = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!user) {
        setData(MOCK_STREAK);
        setLoading(false);
        return;
      }

      const { data: value, error: rpcError } = await supabase.rpc("get_reading_streak", {
        uid: user.id,
      });
      if (rpcError) throw rpcError;
      setData(typeof value === "number" ? value : MOCK_STREAK);
    } catch (err) {
      console.log("Reading streak error:", err?.message || err);
      setError(err);
      setData(MOCK_STREAK);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

  return { data, loading, error, refetch: fetchStreak };
}

// 📊 Insights screen
let MotionView = Animated.View;
try {
  const { MotiView } = require("moti");
  if (MotiView) {
    MotionView = MotiView;
  }
} catch (error) {
  // Fallback gracefully to Animated.View
}

const CARD_ANIMATION = {
  from: { opacity: 0, translateY: 16 },
  animate: { opacity: 1, translateY: 0 },
};

const isMotionComponent = MotionView !== Animated.View;
const motionProps = (delay = 0) =>
  isMotionComponent
    ? {
        from: CARD_ANIMATION.from,
        animate: CARD_ANIMATION.animate,
        transition: { type: "timing", duration: 600, delay },
      }
    : {};

function useAnimatedCounter(value, loading) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const listener = animatedValue.addListener(({ value: v }) => {
      setDisplay(Math.round(v));
    });
    return () => {
      animatedValue.removeListener(listener);
    };
  }, [animatedValue]);

  useEffect(() => {
    if (loading) {
      animatedValue.stopAnimation();
      animatedValue.setValue(0);
      setDisplay(0);
      return;
    }
    Animated.timing(animatedValue, {
      toValue: typeof value === "number" ? value : 0,
      duration: 600,
      useNativeDriver: false,
    }).start();
  }, [animatedValue, loading, value]);

  return display;
}

function useChartProgress(deps, disabled) {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (disabled) {
      animatedValue.stopAnimation();
      animatedValue.setValue(0);
      setProgress(0);
      return;
    }
    animatedValue.stopAnimation();
    animatedValue.setValue(0);
    const id = animatedValue.addListener(({ value }) => {
      setProgress(value);
    });
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 700,
      useNativeDriver: false,
    }).start(() => {
      animatedValue.removeListener(id);
    });

    return () => {
      animatedValue.removeAllListeners();
    };
  }, [...deps, disabled]);

  return progress;
}

function ShimmerPlaceholder({ height, style }) {
  const shimmer = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(shimmer, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  return (
    <Animated.View
      style={[
        {
          height,
          borderRadius: theme.radius,
          backgroundColor: palette.card,
          opacity: shimmer,
        },
        style,
      ]}
    />
  );
}

function SummaryCard({
  title,
  subtitle,
  value,
  loading,
  accent,
  delay = 0,
  column = 0,
  isSolo = false,
}) {
  const displayValue = useAnimatedCounter(value, loading);
  return (
    <MotionView
      style={[
        stylesInsights.summaryCard,
        !isSolo && column === 0 && stylesInsights.summaryCardLeft,
        !isSolo && column === 1 && stylesInsights.summaryCardRight,
        isSolo && stylesInsights.summaryCardSolo,
        { borderColor: accent || palette.gold },
      ]}
      {...motionProps(delay)}
    >
      <Text style={stylesInsights.summaryLabel}>{title}</Text>
      {subtitle ? <Text style={stylesInsights.summarySubtitle}>{subtitle}</Text> : null}
      {loading ? (
        <ShimmerPlaceholder height={32} style={stylesInsights.summaryPlaceholder} />
      ) : (
        <Text style={stylesInsights.summaryValue}>{displayValue}</Text>
      )}
    </MotionView>
  );
}

function CounterRow({ label, value, loading }) {
  const displayValue = useAnimatedCounter(value, loading);
  return (
    <View style={stylesInsights.counterRow}>
      <Text style={stylesInsights.counterLabel}>{label}</Text>
      {loading ? (
        <ShimmerPlaceholder height={18} style={stylesInsights.counterPlaceholder} />
      ) : (
        <Text style={stylesInsights.counterValue}>{displayValue}</Text>
      )}
    </View>
  );
}

function BalancePie({ yin, yang, loading }) {
  if (loading) {
    return <ShimmerPlaceholder height={180} style={stylesInsights.chartPlaceholder} />;
  }

  const data = [
    {
      key: "yin",
      value: yin,
      svg: { fill: palette.gold },
      arc: { outerRadius: "100%", cornerRadius: 12 },
    },
    {
      key: "yang",
      value: yang,
      svg: { fill: palette.goldLight },
      arc: { outerRadius: "100%", cornerRadius: 12 },
    },
  ];

  return (
    <View style={stylesInsights.pieWrapper}>
      <PieChart style={stylesInsights.pieChart} data={data} innerRadius={"55%"} />
      <View style={stylesInsights.pieLabels}>
        <Text style={stylesInsights.pieValue}>{Math.round(yin)}%</Text>
        <Text style={stylesInsights.pieCaption}>Yin</Text>
        <View style={stylesInsights.pieDivider} />
        <Text style={stylesInsights.pieValue}>{Math.round(yang)}%</Text>
        <Text style={stylesInsights.pieCaption}>Yang</Text>
      </View>
    </View>
  );
}

function HexagonLabel({ cx, cy, value, size = "small", fill = palette.white, stroke = palette.gold }) {
  const dimension = size === "medium" ? 42 : 32;
  const scale = dimension / 100;
  const transform = `translate(${cx - 50 * scale}, ${cy - 50 * scale}) scale(${scale})`;

  return (
    <G transform={transform}>
      <Polygon points={HEX_POINTS} fill={fill} stroke={stroke} strokeWidth={4} />
      <SvgText
        x={50}
        y={58}
        textAnchor="middle"
        fontSize={size === "medium" ? 40 : 34}
        fontFamily={fonts.bodyBold}
        fill={stroke}
      >
        {value}
      </SvgText>
    </G>
  );
}

function WeeklyChart({ data, loading }) {
  const chartData = useMemo(() => (Array.isArray(data) && data.length ? data : MOCK_WEEKLY), [data]);
  const hasData = chartData.some((item) => (item?.readings || 0) > 0);
  const progress = useChartProgress([JSON.stringify(chartData)], loading || !hasData);
  const animatedValues = chartData.map((item) => (hasData ? item.readings * progress : 0));

  const Labels = ({ x, y, bandwidth }) =>
    chartData.map((item, index) => {
      if (!item || item.readings <= 0) return null;
      const cx = x(index) + bandwidth / 2;
      const currentValue = animatedValues[index];
      const cy = Math.min(y(currentValue) - 18, y(0) - 18);
      return (
        <HexagonLabel key={`${item.weekday}-${index}`} cx={cx} cy={Math.max(cy, 18)} value={item.readings} />
      );
    });

  if (loading) {
    return <ShimmerPlaceholder height={200} style={stylesInsights.chartPlaceholder} />;
  }

  if (!hasData) {
    return (
      <View style={stylesInsights.chartEmpty}>
        <Text style={stylesInsights.chartEmptyText}>No readings yet</Text>
      </View>
    );
  }

  const values = animatedValues;

  return (
    <View>
      <BarChart
        style={stylesInsights.barChart}
        data={values}
        svg={{ fill: palette.gold }}
        contentInset={{ top: 20, bottom: 24 }}
        spacingInner={0.35}
      >
        <Grid direction={Grid.Direction.HORIZONTAL} svg={{ stroke: palette.border }} />
        <Labels />
      </BarChart>
      <XAxis
        style={stylesInsights.xAxis}
        data={values}
        formatLabel={(value, index) => chartData[index]?.weekday || ""}
        contentInset={{ left: 18, right: 18 }}
        svg={{ fontFamily: fonts.body, fontSize: 12, fill: palette.inkMuted }}
      />
    </View>
  );
}

function MonthlyChart({ data, loading }) {
  const chartData = useMemo(() => (Array.isArray(data) && data.length ? data : MOCK_MONTHLY), [data]);
  const hasData = chartData.some((item) => (item?.readings || 0) > 0);
  const progress = useChartProgress([JSON.stringify(chartData)], loading || !hasData);
  const animatedValues = chartData.map((item) => (hasData ? item.readings * progress : 0));

  const Labels = ({ x, y, bandwidth }) =>
    chartData.map((item, index) => {
      if (!item || item.readings <= 0) return null;
      const cx = x(index) + bandwidth / 2;
      const currentValue = animatedValues[index];
      const cy = Math.min(y(currentValue) - 18, y(0) - 18);
      return (
        <HexagonLabel
          key={`${item.month}-${index}`}
          cx={cx}
          cy={Math.max(cy, 18)}
          value={item.readings}
          size="small"
        />
      );
    });

  if (loading) {
    return <ShimmerPlaceholder height={220} style={stylesInsights.chartPlaceholder} />;
  }

  if (!hasData) {
    return (
      <View style={stylesInsights.chartEmpty}>
        <Text style={stylesInsights.chartEmptyText}>No readings yet</Text>
      </View>
    );
  }

  const values = animatedValues;

  return (
    <View>
      <BarChart
        style={stylesInsights.barChartTall}
        data={values}
        svg={{ fill: palette.gold }}
        contentInset={{ top: 24, bottom: 24 }}
        spacingInner={0.25}
      >
        <Grid direction={Grid.Direction.HORIZONTAL} svg={{ stroke: palette.border }} />
        <Labels />
      </BarChart>
      <XAxis
        style={stylesInsights.xAxis}
        data={values}
        formatLabel={(value, index) => chartData[index]?.month || ""}
        contentInset={{ left: 20, right: 20 }}
        svg={{ fontFamily: fonts.body, fontSize: 12, fill: palette.inkMuted }}
      />
    </View>
  );
}

function TopCastsChart({ data, loading }) {
  const chartData = useMemo(() => {
    const base = Array.isArray(data) ? data : [];

    const sorted = [...base]
      .filter((item) =>
        item && typeof item.total_casts === "number" && item.hexagram_primary != null
      )
      .map((item) => ({
        hexagram_primary: Number(item.hexagram_primary),
        total_casts: Number(item.total_casts) || 0,
      }))
      .sort((a, b) => (b.total_casts || 0) - (a.total_casts || 0));

    const trimmed = sorted.slice(0, 5);
    const padded = [...trimmed];
    while (padded.length < 5) {
      padded.push({ hexagram_primary: null, total_casts: 0 });
    }
    return padded;
  }, [data]);
  const hasData = chartData.some((item) => (item?.total_casts || 0) > 0);
  const progress = useChartProgress([JSON.stringify(chartData)], loading || !hasData);
  const animatedValues = chartData.map((item) =>
    hasData ? (item.total_casts || 0) * progress : 0
  );

  const Labels = ({ x, y, bandwidth }) =>
    chartData.map((item, index) => {
      if (!item || item.total_casts <= 0) return null;
      const cx = x(index) + bandwidth / 2;
      const cy = Math.min(y(animatedValues[index]) - 18, y(0) - 18);
      return (
        item.total_casts > 0 ? (
          <HexagonLabel
            key={`top-cast-${item.hexagram_primary ?? index}-${index}`}
            cx={cx}
            cy={Math.max(cy, 18)}
            value={item.total_casts}
            size="small"
          />
        ) : null
      );
    });

  if (loading) {
    return <ShimmerPlaceholder height={220} style={stylesInsights.chartPlaceholder} />;
  }

  if (!hasData) {
    return (
      <View style={stylesInsights.chartEmpty}>
        <Text style={stylesInsights.chartEmptyText}>
          You haven’t cast enough hexagrams yet to generate insights.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <BarChart
        style={stylesInsights.barChart}
        data={animatedValues}
        svg={{ fill: palette.gold }}
        contentInset={{ top: 20, bottom: 24 }}
        spacingInner={0.3}
      >
        <Grid direction={Grid.Direction.HORIZONTAL} svg={{ stroke: palette.border }} />
        <Labels />
      </BarChart>
      <XAxis
        style={stylesInsights.xAxis}
        data={animatedValues}
        formatLabel={(value, index) =>
          chartData[index]?.hexagram_primary != null
            ? `Hex ${chartData[index].hexagram_primary}`
            : ""
        }
        contentInset={{ left: 24, right: 24 }}
        svg={{
          fontFamily: fonts.bodyBold,
          fontSize: 12,
          fill: palette.ink,
          textAnchor: "middle",
        }}
      />
    </View>
  );
}

function InsightsOverviewScreen() {
  const { isPremium } = useAuth();
  const premiumMember = Boolean(isPremium);
  const navigation = useNavigation();
  const {
    data: summary,
    loading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useInsightsSummary();
  const {
    data: counts,
    loading: countsLoading,
    error: countsError,
    refetch: refetchCounts,
  } = useInsightsCounts();
  const {
    data: balance,
    loading: balanceLoading,
    error: balanceError,
    refetch: refetchBalance,
  } = useInsightsBalance();
  const {
    data: streak,
    loading: streakLoading,
    error: streakError,
    refetch: refetchStreak,
  } = useReadingStreak();
  const {
    data: weeklyData,
    loading: weeklyLoading,
    error: weeklyError,
    refetch: refetchWeekly,
  } = useInsightsWeekly();
  const {
    data: monthlyData,
    loading: monthlyLoading,
    error: monthlyError,
    refetch: refetchMonthly,
  } = useInsightsMonthly();
  const {
    data: topCastsData,
    loading: topCastsLoading,
    error: topCastsError,
    refetch: refetchTopCasts,
  } = useInsightsTopCasts();

  const [hexagrams, setHexagrams] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    let active = true;
    if (!premiumMember) {
      return () => {
        active = false;
      };
    }
    loadHexagrams().then((rows) => {
      if (!active) return;
      const ordered = [...rows].sort((a, b) => (a.number || 0) - (b.number || 0));
      setHexagrams(ordered);
    });
    return () => {
      active = false;
    };
  }, [premiumMember]);

  const mostDrawnName = useMemo(() => {
    if (!summary?.most_drawn_hexagram) return "";
    return (
      getHexagramNameByNumber(hexagrams, summary.most_drawn_hexagram) || "Unknown"
    );
  }, [hexagrams, summary?.most_drawn_hexagram]);

  const refetchAll = useCallback(() => {
    refetchSummary();
    refetchCounts();
    refetchBalance();
    refetchStreak();
    refetchWeekly();
    refetchMonthly();
    refetchTopCasts();
  }, [
    refetchBalance,
    refetchCounts,
    refetchMonthly,
    refetchStreak,
    refetchSummary,
    refetchTopCasts,
    refetchWeekly,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (!premiumMember) return;
      refetchAll();
    }, [refetchAll, premiumMember])
  );

  useEffect(() => {
    let channel;
    let mounted = true;
    (async () => {
      if (!premiumMember) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!mounted || !user) return;
      channel = supabase
        .channel("insights-overview")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "JournalEntries",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            refetchAll();
          }
        )
        .subscribe();
    })();
    return () => {
      mounted = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [premiumMember, refetchAll]);

  const summaryCards = [
    {
      title: "Total Readings",
      value: summary?.total_readings || 0,
      loading: summaryLoading,
    },
    {
      title: "Most-Drawn Hexagram",
      subtitle: mostDrawnName
        ? `Hexagram ${summary?.most_drawn_hexagram}: ${mostDrawnName}`
        : "—",
      value: summary?.most_drawn_hexagram || 0,
      loading: summaryLoading,
    },
    {
      title: "Reading Streak",
      subtitle: "Consecutive days",
      value: streak || 0,
      loading: streakLoading,
    },
    {
      title: "Distinct Hexagrams",
      subtitle: "Primary draws",
      value: summary?.distinct_hexagrams || 0,
      loading: summaryLoading,
    },
  ];

  const summaryRows = [];
  for (let i = 0; i < summaryCards.length; i += 2) {
    summaryRows.push(summaryCards.slice(i, i + 2));
  }

  useEffect(() => {
    const activeError =
      summaryError ||
      countsError ||
      balanceError ||
      streakError ||
      weeklyError ||
      monthlyError ||
      topCastsError;
    if (activeError) {
      setErrorMessage("Showing recent data");
    } else {
      setErrorMessage(null);
    }
  }, [
    balanceError,
    countsError,
    monthlyError,
    streakError,
    summaryError,
    topCastsError,
    weeklyError,
  ]);

  if (!premiumMember) {
    return (
      <LinearGradient
        colors={[palette.parchmentA, palette.parchmentB, palette.parchmentGold]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={stylesInsights.gradient}
      >
        <ScrollView
          contentContainerStyle={[
            stylesInsights.container,
            { paddingBottom: theme.space(6) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={stylesInsights.screenTitle}>Insights Overview</Text>
          <Text style={stylesInsights.screenSubtitle}>
            A reflective glance at your journey with the I Ching.
          </Text>
          <UpgradeCallout
            title="Premium analytics"
            description={
              "Unlock weekly and monthly patterns, your casting streak, and the top hexagrams you draw most often. Premium is £2.99 per month."
            }
            onUpgrade={() => navigation.navigate("Premium")}
            icon="stats-chart-outline"
          />
        </ScrollView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[palette.parchmentA, palette.parchmentB, palette.parchmentGold]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={stylesInsights.gradient}
    >
      <ScrollView
        contentContainerStyle={[
          stylesInsights.container,
          { paddingBottom: theme.space(6) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={stylesInsights.screenTitle}>Insight Overview</Text>
        <Text style={stylesInsights.screenSubtitle}>
          A reflective glance at your journey with the I Ching.
        </Text>
        {errorMessage ? <Text style={stylesInsights.errorText}>{errorMessage}</Text> : null}

        <View style={stylesInsights.summaryGrid}>
          {summaryRows.map((rowCards, rowIndex) => (
            <View
              key={`summary-row-${rowIndex}`}
              style={[
                stylesInsights.summaryRow,
                rowIndex === summaryRows.length - 1 && { marginBottom: 0 },
              ]}
            >
              {rowCards.map((card, columnIndex) => {
                const cardIndex = rowIndex * 2 + columnIndex;
                return (
                  <SummaryCard
                    key={card.title}
                    title={card.title}
                    subtitle={card.subtitle}
                    value={card.value}
                    loading={card.loading}
                    accent={cardIndex === 1 ? palette.goldLight : palette.gold}
                    delay={cardIndex * 80}
                    column={columnIndex}
                    isSolo={rowCards.length === 1}
                  />
                );
              })}
            </View>
          ))}
        </View>

        <MotionView style={stylesInsights.counterCard} {...motionProps(120)}>
          <Text style={stylesInsights.sectionTitle}>Reading cadence</Text>
          <CounterRow
            label="Today"
            value={counts.readings_today}
            loading={countsLoading}
          />
          <CounterRow
            label="This week"
            value={counts.readings_week}
            loading={countsLoading}
          />
          <CounterRow
            label="This month"
            value={counts.readings_month}
            loading={countsLoading}
          />
          <CounterRow
            label="This year"
            value={counts.readings_year}
            loading={countsLoading}
          />
          <CounterRow
            label="Total"
            value={counts.readings_total}
            loading={countsLoading}
          />
        </MotionView>

        <MotionView style={stylesInsights.balanceCard} {...motionProps(160)}>
          <Text style={stylesInsights.sectionTitle}>Energetic balance</Text>
          <BalancePie
            yin={balance.yin_percent}
            yang={balance.yang_percent}
            loading={balanceLoading}
          />
        </MotionView>

        <MotionView style={stylesInsights.chartCard} {...motionProps(200)}>
          <Text style={stylesInsights.sectionTitle}>Weekly readings</Text>
          <Text style={stylesInsights.sectionCaption}>Mon to Sun</Text>
          <WeeklyChart data={weeklyData} loading={weeklyLoading} />
        </MotionView>

        <MotionView style={stylesInsights.chartCard} {...motionProps(240)}>
          <Text style={stylesInsights.sectionTitle}>Monthly readings</Text>
          <Text style={stylesInsights.sectionCaption}>Past 12 months</Text>
          <MonthlyChart data={monthlyData} loading={monthlyLoading} />
        </MotionView>

        <MotionView style={stylesInsights.chartCard} {...motionProps(280)}>
          <Text style={stylesInsights.sectionTitle}>Top 5 casts</Text>
          <Text style={stylesInsights.sectionCaption}>Most frequent hexagrams</Text>
          <TopCastsChart data={topCastsData} loading={topCastsLoading} />
        </MotionView>
      </ScrollView>
    </LinearGradient>
  );
}

const stylesInsights = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    padding: theme.space(3),
    paddingTop: theme.space(3) + screenTopPadding,
  },
  screenTitle: {
    fontFamily: fonts.title,
    fontSize: 30,
    color: palette.ink,
  },
  screenSubtitle: {
    fontFamily: fonts.body,
    color: palette.inkMuted,
    marginTop: theme.space(0.5),
    marginBottom: theme.space(3),
  },
  errorText: {
    fontFamily: fonts.body,
    color: palette.goldDeep,
    marginBottom: theme.space(2),
  },
  summaryGrid: {
    marginBottom: theme.space(3),
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: theme.space(2),
  },
  summaryCard: {
    flex: 1,
    minWidth: 150,
    padding: theme.space(2),
    borderRadius: theme.radius,
    borderWidth: 1,
    backgroundColor: palette.card,
    shadowColor: palette.goldDeep,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  summaryCardLeft: {
    marginRight: theme.space(1),
  },
  summaryCardRight: {
    marginLeft: theme.space(1),
  },
  summaryCardSolo: {
    marginLeft: 0,
    marginRight: 0,
  },
  summaryLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.ink,
  },
  summarySubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.inkMuted,
    marginTop: 4,
  },
  summaryValue: {
    fontFamily: fonts.title,
    fontSize: 32,
    color: palette.ink,
    marginTop: theme.space(1),
  },
  summaryPlaceholder: {
    marginTop: theme.space(1),
  },
  counterCard: {
    backgroundColor: palette.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    padding: theme.space(2),
    marginBottom: theme.space(3),
    shadowColor: palette.goldDeep,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  sectionTitle: {
    fontFamily: fonts.title,
    fontSize: 20,
    color: palette.ink,
    marginBottom: theme.space(1.5),
  },
  sectionCaption: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.inkMuted,
    marginTop: -theme.space(0.75),
    marginBottom: theme.space(1.5),
  },
  counterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  counterLabel: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.ink,
  },
  counterValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.goldDeep,
  },
  counterPlaceholder: {
    width: 48,
  },
  balanceCard: {
    backgroundColor: palette.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    padding: theme.space(2),
    marginBottom: theme.space(3),
    shadowColor: palette.goldDeep,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  pieWrapper: {
    alignItems: "center",
  },
  pieChart: {
    height: 200,
    width: 200,
  },
  pieLabels: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  pieValue: {
    fontFamily: fonts.title,
    fontSize: 20,
    color: palette.ink,
  },
  pieCaption: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.inkMuted,
    marginBottom: 4,
  },
  pieDivider: {
    height: 1,
    width: 60,
    backgroundColor: palette.border,
    marginVertical: 6,
  },
  chartCard: {
    backgroundColor: palette.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    padding: theme.space(2),
    marginBottom: theme.space(3),
    shadowColor: palette.goldDeep,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  barChart: {
    height: 180,
  },
  barChartTall: {
    height: 220,
  },
  xAxis: {
    marginHorizontal: -10,
    marginTop: theme.space(1),
  },
  chartPlaceholder: {
    borderRadius: theme.radius,
  },
  chartEmpty: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.space(2),
  },
  chartEmptyText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.inkMuted,
  },
});

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const JournalStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();

function randomLine() {
  const roll = Math.floor(Math.random() * 4) + 6;
  if (roll === 6) return { v: 0, moving: true, roll };
  if (roll === 7) return { v: 1, moving: false, roll };
  if (roll === 8) return { v: 0, moving: false, roll };
  return { v: 1, moving: true, roll };
}

function lineFromManualValue(value) {
  const numeric = Number(value);
  if (numeric === 6) return { v: 0, moving: true, roll: 6 };
  if (numeric === 7) return { v: 1, moving: false, roll: 7 };
  if (numeric === 8) return { v: 0, moving: false, roll: 8 };
  if (numeric === 9) return { v: 1, moving: true, roll: 9 };
  return null;
}

function flipLinesForResult(lines) {
  return lines.map((line) => ({
    v: line.moving ? (line.v ? 0 : 1) : line.v,
    moving: false,
  }));
}

function linesKey(lines) {
  return lines.map((line) => (line.v ? "1" : "0")).join("");
}

function chooseByLines(lines, list) {
  if (!list?.length) return null;
  const key = linesKey(lines);
  return (
    list.find(
      (item) =>
        item.linesBinary && item.linesBinary.replace(/\s+/g, "") === key
    ) || null
  );
}

function deriveChangingLineSummaries(hex, lines) {
  if (!hex || !Array.isArray(lines)) return [];
  const details = Array.isArray(hex.changingLines) ? hex.changingLines : [];
  return lines
    .map((line, index) => ({ line, index }))
    .filter((entry) => entry.line?.moving)
    .map((entry) => {
      const text = (details[entry.index] || "").toString().trim();
      if (!text) return null;
      return { number: entry.index + 1, text };
    })
    .filter(Boolean);
}

function fullChangingLineSummaries(hex) {
  if (!hex) return [];
  return (hex.changingLines || [])
    .map((value, index) => {
      const text = (value || "").toString().trim();
      if (!text) return null;
      return { number: index + 1, text };
    })
    .filter(Boolean);
}

// 🗒️ Journal context
const JournalContext = createContext();

const AuthContext = createContext(null);

function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthContext provider");
  }
  return ctx;
}

const safeParseJSON = (value, fallback = {}) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    console.log("JSON parse error:", error?.message || error);
    return fallback;
  }
};

function JournalProvider({ children }) {
  const { session, authReady, isPremium } = useAuth();
  const userId = session?.user?.id;
  const premiumMember = Boolean(isPremium && userId);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [remoteCount, setRemoteCount] = useState(0);
  const pendingNoteTimers = useRef({});

  const storageKey = useMemo(
    () => (userId ? `journal_entries_${userId}` : "journal_entries_guest"),
    [userId]
  );

  const hydrateEntry = useCallback(
    (row, fallbackSummary = {}) => {
      const summary = Object.keys(fallbackSummary).length
        ? fallbackSummary
        : safeParseJSON(row?.summary, {});
      return {
        id: row.id,
        createdAt: row.created_at ? new Date(row.created_at) : new Date(),
        note: row.notes ?? "",
        question: row.question ?? "",
        primary: summary.primary ?? null,
        resulting: summary.resulting ?? null,
        primaryLines: Array.isArray(summary.primaryLines)
          ? summary.primaryLines
          : [],
        resultingLines: Array.isArray(summary.resultingLines)
          ? summary.resultingLines
          : [],
        aiSummary:
          fallbackSummary.aiSummary ?? row?.ai_summary ?? "",
        synced: true,
      };
    },
    []
  );

  const reviveLocalEntry = useCallback((item) => {
    if (!item) return null;
    return {
      id: item.id,
      createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
      note: item.note ?? "",
      question: item.question ?? "",
      primary: item.primary ?? null,
      resulting: item.resulting ?? null,
      primaryLines: Array.isArray(item.primaryLines)
        ? item.primaryLines
        : [],
      resultingLines: Array.isArray(item.resultingLines)
        ? item.resultingLines
        : [],
      aiSummary: item.aiSummary ?? "",
      synced: Boolean(item.synced),
    };
  }, []);

  const persistLocalEntries = useCallback(
    async (list) => {
      try {
        if (!storageKey) return;
        const serialisable = (list || []).map((entry) => ({
          ...entry,
          createdAt: entry.createdAt
            ? entry.createdAt.toISOString()
            : new Date().toISOString(),
        }));
        await AsyncStorage.setItem(storageKey, JSON.stringify(serialisable));
      } catch (error) {
        console.log("Local journal persist error:", error?.message || error);
      }
    },
    [storageKey]
  );

  const updateEntriesState = useCallback(
    (updater) => {
      setEntries((prev) => {
        const next = updater(prev);
        persistLocalEntries(next);
        return next;
      });
    },
    [persistLocalEntries]
  );

  const loadEntries = useCallback(async () => {
    if (!authReady) {
      return;
    }
    setLoading(true);
    let localEntries = [];
    try {
      if (storageKey) {
        const stored = await AsyncStorage.getItem(storageKey);
        const parsed = safeParseJSON(stored, []);
        if (Array.isArray(parsed)) {
          localEntries = parsed
            .map(reviveLocalEntry)
            .filter(Boolean);
        }
      }
      localEntries.sort((a, b) => b.createdAt - a.createdAt);
      setEntries(localEntries);

      if (!premiumMember) {
        setRemoteCount(0);
        await persistLocalEntries(localEntries);
        return;
      }

      const { data, error } = await supabase
        .from("JournalEntries")
        .select(
          "id, question, notes, hexagram_primary, hexagram_resulting, summary, ai_summary, created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const remoteEntries = (data || []).map((row) => ({
        ...hydrateEntry(row),
        synced: true,
      }));
      setRemoteCount(remoteEntries.length);
      const remoteMap = new Map(remoteEntries.map((item) => [item.id, true]));
      const merged = [...remoteEntries];
      localEntries.forEach((entry) => {
        if (!remoteMap.has(entry.id)) {
          merged.push({ ...entry, synced: false });
        }
      });
      merged.sort((a, b) => b.createdAt - a.createdAt);
      setEntries(merged);
      await persistLocalEntries(merged);
    } catch (error) {
      console.log("Journal fetch error:", error?.message || error);
      setRemoteCount(localEntries.filter((entry) => entry.synced).length);
      if (premiumMember) {
        Alert.alert(
          "Showing recent data",
          "Cloud backup is unavailable. Displaying the latest entries stored on this device."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [authReady, storageKey, premiumMember, userId, hydrateEntry, reviveLocalEntry, persistLocalEntries]);

  useEffect(() => {
    Object.values(pendingNoteTimers.current || {}).forEach((timer) =>
      clearTimeout(timer)
    );
    pendingNoteTimers.current = {};
    if (!authReady) return;
    loadEntries();
  }, [authReady, storageKey, premiumMember, userId, loadEntries]);

  useEffect(() => {
    return () => {
      Object.values(pendingNoteTimers.current || {}).forEach((timer) =>
        clearTimeout(timer)
      );
    };
  }, []);

  const addEntry = useCallback(
    async (entry) => {
      const summaryPayload = {
        primary: entry.primary ?? null,
        resulting: entry.resulting ?? null,
        primaryLines: entry.primaryLines ?? [],
        resultingLines: entry.resultingLines ?? [],
      };

      if (premiumMember && authReady && userId && remoteCount < 1000) {
        try {
          const { data, error } = await supabase
            .from("JournalEntries")
            .insert({
              user_id: userId,
              question: entry.question ?? "",
              notes: entry.note ?? "",
              hexagram_primary: entry.primary?.number ?? null,
              hexagram_resulting: entry.resulting?.number ?? null,
              summary: JSON.stringify(summaryPayload),
            })
            .select()
            .single();
          if (error) throw error;
          const hydrated = { ...hydrateEntry(data, summaryPayload), synced: true };
          setRemoteCount((prev) => prev + 1);
          updateEntriesState((prev) => [hydrated, ...prev]);
          return hydrated.id;
        } catch (error) {
          console.log("Journal cloud backup error:", error?.message || error);
          Alert.alert(
            "Cloud backup unavailable",
            "Your entry is saved on this device and will sync when the backup is available."
          );
        }
      } else if (premiumMember && remoteCount >= 1000) {
        Alert.alert(
          "Backup limit reached",
          "Premium backup can store up to 1,000 entries. New readings will remain on this device."
        );
      }

      const localEntry = {
        id: `local-${createLocalId()}`,
        createdAt: new Date(),
        note: entry.note ?? "",
        question: entry.question ?? "",
        primary: entry.primary ?? null,
        resulting: entry.resulting ?? null,
        primaryLines: entry.primaryLines ?? [],
        resultingLines: entry.resultingLines ?? [],
        aiSummary: entry.aiSummary ?? "",
        synced: false,
      };
      updateEntriesState((prev) => [localEntry, ...prev]);
      return localEntry.id;
    },
    [premiumMember, authReady, userId, remoteCount, hydrateEntry, updateEntriesState]
  );

  const updateEntryNote = useCallback(
    (id, note) => {
      const targetEntry = entries.find((item) => item.id === id);
      updateEntriesState((prev) =>
        prev.map((item) => (item.id === id ? { ...item, note } : item))
      );

      const shouldSync =
        premiumMember &&
        authReady &&
        userId &&
        targetEntry?.synced &&
        !String(id).startsWith("local-");
      if (!shouldSync) {
        return;
      }

      if (pendingNoteTimers.current[id]) {
        clearTimeout(pendingNoteTimers.current[id]);
      }
      pendingNoteTimers.current[id] = setTimeout(async () => {
        try {
          await supabase
            .from("JournalEntries")
            .update({ notes: note })
            .eq("id", id)
            .eq("user_id", userId);
        } catch (error) {
          console.log("Note update error:", error?.message || error);
        }
      }, 750);
    },
    [entries, premiumMember, authReady, userId, updateEntriesState]
  );

  const removeEntry = useCallback(
    async (id) => {
      const entry = entries.find((item) => item.id === id);
      if (!entry) return;

      if (pendingNoteTimers.current[id]) {
        clearTimeout(pendingNoteTimers.current[id]);
        delete pendingNoteTimers.current[id];
      }

      updateEntriesState((prev) =>
        prev.filter((item) => item.id !== id)
      );

      const shouldSync =
        premiumMember &&
        authReady &&
        userId &&
        entry.synced &&
        !String(id).startsWith("local-");
      if (!shouldSync) {
        return;
      }

      try {
        const { error } = await supabase
          .from("JournalEntries")
          .delete()
          .eq("id", id)
          .eq("user_id", userId)
          .select("id");
        if (error) throw error;
        setRemoteCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error("❌ Delete error:", error?.message || error);
        Alert.alert(
          "Error",
          "Failed to remove the entry from backup. It will remain available locally."
        );
        updateEntriesState((prev) => {
          const next = [...prev, entry];
          next.sort((a, b) => b.createdAt - a.createdAt);
          return next;
        });
      }
    },
    [entries, premiumMember, authReady, userId, updateEntriesState]
  );

  const setEntryAiSummary = useCallback((id, aiSummary) => {
    updateEntriesState((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, aiSummary } : item
      )
    );
  }, [updateEntriesState]);

  const fetchEntryAiSummary = useCallback(
    async (id) => {
      const targetEntry = entries.find((item) => item.id === id);
      if (!premiumMember || !authReady || !userId || !targetEntry?.synced) {
        return targetEntry?.aiSummary ?? "";
      }
      try {
        const { data, error } = await supabase
          .from("JournalEntries")
          .select("ai_summary")
          .eq("id", id)
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        const aiSummary = data?.ai_summary ?? "";
        updateEntriesState((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, aiSummary } : item
          )
        );
        return aiSummary;
      } catch (error) {
        console.log("AI summary fetch error:", error?.message || error);
        throw error;
      }
    },
    [entries, premiumMember, authReady, userId, updateEntriesState]
  );

  const confirmDelete = useCallback(
    (id) => {
      Alert.alert("Delete entry?", "Are you sure you want to remove this entry?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => setTimeout(() => removeEntry(id), 150),
        },
      ]);
    },
    [removeEntry]
  );

  const value = useMemo(
    () => ({
      entries,
      loading,
      addEntry,
      updateEntryNote,
      setEntryAiSummary,
      fetchEntryAiSummary,
      removeEntry,
      confirmDelete,
      refreshEntries: loadEntries,
    }),
    [
      entries,
      loading,
      addEntry,
      updateEntryNote,
      setEntryAiSummary,
      fetchEntryAiSummary,
      removeEntry,
      confirmDelete,
      loadEntries,
    ]
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) {
    throw new Error("useJournal must be used within a JournalProvider");
  }
  return ctx;
}

// 🌄 Background
function GradientBackground({ children }) {
  return (
    <LinearGradient
      colors={[palette.parchmentA, palette.parchmentB, palette.parchmentGold]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={{ flex: 1 }}
    >
      {children}
    </LinearGradient>
  );
}

// 🪵 Cards & buttons
function SectionCard({ children, style }) {
  return (
    <View
      style={[
        {
          backgroundColor: palette.card,
          borderRadius: theme.radius,
          borderWidth: 1,
          borderColor: palette.border,
          padding: theme.space(1.75),
          marginBottom: theme.space(2),
          shadowColor: palette.goldDeep,
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 5 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function GoldButton({ onPress, children, icon, kind = "primary", full = false, disabled = false }) {
  const primary = kind === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          alignSelf: full ? "stretch" : "flex-start",
          paddingHorizontal: theme.space(2),
          paddingVertical: theme.space(1.25),
          borderRadius: theme.radius,
          marginTop: theme.space(1),
          borderWidth: 1,
          shadowColor: palette.goldDeep,
          shadowOpacity: pressed ? 0.15 : 0.25,
          shadowRadius: pressed ? 6 : 10,
          shadowOffset: { width: 0, height: pressed ? 2 : 6 },
        },
        primary
          ? { backgroundColor: palette.gold, borderColor: palette.gold }
          : { backgroundColor: palette.white, borderColor: palette.gold },
        pressed && !disabled && { opacity: 0.98 },
        disabled && { opacity: 0.6, shadowOpacity: 0.1 },
      ]}
    >
      {icon}
      <Text
        style={{
          marginLeft: icon ? 8 : 0,
          fontFamily: fonts.bodyBold,
          fontSize: 16,
          color: primary ? palette.white : palette.gold,
        }}
      >
        {children}
      </Text>
    </Pressable>
  );
}

function UpgradeCallout({ title, description, onUpgrade, style, icon = "sparkles-outline" }) {
  return (
    <SectionCard
      style={[
        {
          backgroundColor: palette.card,
        },
        style,
      ]}
    >
      <Text style={{ fontFamily: fonts.title, fontSize: 18, color: palette.ink }}>
        {title}
      </Text>
      <Text
        style={{
          fontFamily: fonts.body,
          fontSize: 15,
          color: palette.ink,
          marginTop: 8,
          lineHeight: 22,
        }}
      >
        {description}
      </Text>
      <GoldButton
        full
        onPress={onUpgrade}
        icon={<Ionicons name={icon} size={18} color={palette.white} />}
      >
        Upgrade to Premium (£2.99/month)
      </GoldButton>
    </SectionCard>
  );
}

const loginStyles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: theme.space(2.5),
    justifyContent: "center",
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    padding: theme.space(2.5),
    shadowColor: palette.goldDeep,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.space(1.5),
  },
  title: {
    fontFamily: fonts.title,
    fontSize: 28,
    color: palette.ink,
    marginLeft: theme.space(1),
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.inkMuted,
    lineHeight: 22,
    marginBottom: theme.space(2),
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: palette.ink,
    marginTop: theme.space(1.5),
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: theme.radius,
    paddingHorizontal: theme.space(1.5),
    paddingVertical: theme.space(1),
    backgroundColor: palette.white,
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.ink,
  },
  helperText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.inkMuted,
    marginTop: theme.space(1),
  },
  buttonRow: {
    marginTop: theme.space(2.5),
    flexDirection: "row",
    justifyContent: "space-between",
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.space(1.25),
    borderRadius: theme.radius,
    borderWidth: 1,
    marginHorizontal: theme.space(0.5),
  },
  buttonPrimary: {
    backgroundColor: palette.gold,
    borderColor: palette.gold,
  },
  buttonSecondary: {
    backgroundColor: palette.white,
    borderColor: palette.gold,
  },
  buttonTextPrimary: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.white,
  },
  buttonTextSecondary: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.gold,
  },
});

const loginGradientColors = [
  palette.parchmentA,
  palette.parchmentB,
  palette.parchmentGold,
];

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState(null);

  const handleAuth = async (type) => {
    if (!email.trim() || !password) {
      Alert.alert("Missing information", "Please enter both email and password.");
      return;
    }
    setSubmitting(true);
    setMode(type);
    try {
      if (type === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      Alert.alert(
        type === "login" ? "Login failed" : "Sign up failed",
        error?.message || "Please try again."
      );
    } finally {
      setSubmitting(false);
      setMode(null);
    }
  };

  return (
    <LinearGradient
      colors={loginGradientColors}
      style={loginStyles.gradient}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={loginStyles.container}
            keyboardShouldPersistTaps="handled"
          >
            <View style={loginStyles.card}>
              <View style={loginStyles.titleRow}>
                <Ionicons name="sparkles-outline" size={28} color={palette.goldDeep} />
                <Text style={loginStyles.title}>Welcome Back</Text>
              </View>
              <Text style={loginStyles.subtitle}>
                Sign in or create an account to continue your journey with the I Ching.
              </Text>

              <Text style={loginStyles.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={palette.inkMuted}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                style={loginStyles.input}
              />

              <Text style={loginStyles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter a secure password"
                placeholderTextColor={palette.inkMuted}
                secureTextEntry
                textContentType="password"
                style={loginStyles.input}
              />

              <Text style={loginStyles.helperText}>
                Use the credentials associated with your Supabase profile.
              </Text>

              <View style={loginStyles.buttonRow}>
                <Pressable
                  style={[loginStyles.button, loginStyles.buttonPrimary]}
                  onPress={() => handleAuth("login")}
                  disabled={submitting}
                >
                  {submitting && mode === "login" ? (
                    <ActivityIndicator color={palette.white} />
                  ) : (
                    <Text style={loginStyles.buttonTextPrimary}>Login</Text>
                  )}
                </Pressable>
                <Pressable
                  style={[loginStyles.button, loginStyles.buttonSecondary]}
                  onPress={() => handleAuth("signup")}
                  disabled={submitting}
                >
                  {submitting && mode === "signup" ? (
                    <ActivityIndicator color={palette.gold} />
                  ) : (
                    <Text style={loginStyles.buttonTextSecondary}>Sign Up</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

// 🟡 Hexagram lines
function Line({ v, moving }) {
  const color = moving ? palette.gold : palette.ink;
  const glow = moving ? palette.gold : "transparent";
  return (
    <View style={{ height: 22, justifyContent: "center", marginVertical: 5 }}>
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: 22,
          borderRadius: 12,
          shadowColor: glow,
          shadowOpacity: moving ? 0.45 : 0,
          shadowRadius: 9,
        }}
      />
      {v === 1 ? (
        <View style={{ height: 12, borderRadius: 8, backgroundColor: color }} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, height: 12, borderRadius: 8, backgroundColor: color }} />
          <View style={{ width: 18 }} />
          <View style={{ flex: 1, height: 12, borderRadius: 8, backgroundColor: color }} />
        </View>
      )}
    </View>
  );
}

function AnimatedLine({ v, moving, delay = 0 }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 360,
      delay,
      useNativeDriver: true,
    }).start();
  }, [delay, opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <Line v={v} moving={moving} />
    </Animated.View>
  );
}

// 🔶 Hexagon thumb
const HEX_POINTS = "50,5 93,28 93,72 50,95 7,72 7,28";

function HexagonThumbnail({ uri, size = 52 }) {
  const imageSource =
    typeof uri === "string" && uri.trim().length
      ? uri.trim().replace(/^http:\/\//i, "https://")
      : "";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 4,
        shadowColor: palette.goldDeep,
        shadowOpacity: 0.25,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 4,
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <ClipPath id="hex-clip">
            <Polygon points={HEX_POINTS} />
          </ClipPath>
          <SvgLinearGradient id="hex-placeholder" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={palette.goldLight} stopOpacity="0.9" />
            <Stop offset="100%" stopColor={palette.gold} stopOpacity="0.9" />
          </SvgLinearGradient>
        </Defs>
        {imageSource ? (
          <SvgImage
            key={imageSource}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid slice"
            href={{ uri: imageSource }}
            xlinkHref={imageSource}
            clipPath="url(#hex-clip)"
          />
        ) : (
          <Path d="M0 0h100v100H0z" fill="url(#hex-placeholder)" clipPath="url(#hex-clip)" />
        )}
        <Polygon points={HEX_POINTS} fill="transparent" stroke={palette.gold} strokeWidth={3} />
      </Svg>
    </View>
  );
}

// 🪞 Hexagram card & modal
function HexagramCard({ item, onPress, showDetails = true }) {
  if (!item) return null;
  const hasImage = !!item.imageUrl;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: palette.card,
          borderRadius: theme.radius,
          borderWidth: 1,
          borderColor: palette.border,
          overflow: "hidden",
          marginBottom: theme.space(2),
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View style={stylesHexagramCard.imageWrapper}>
        {hasImage ? (
          <Image
            source={{ uri: item.imageUrl }}
            style={stylesHexagramCard.image}
            resizeMode="cover"
          />
        ) : (
          <View style={stylesHexagramCard.placeholder}>
            <Ionicons name="sparkles-outline" size={30} color={palette.goldDeep} />
          </View>
        )}
      </View>
      {showDetails ? (
        <View style={stylesHexagramCard.details}>
          <Text style={stylesHexagramCard.name}>{item.name}</Text>
          {item.number ? (
            <Text style={stylesHexagramCard.subtitle}>Hexagram {item.number}</Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const stylesHexagramCard = StyleSheet.create({
  imageWrapper: {
    width: "100%",
    aspectRatio: 1,
    position: "relative",
    backgroundColor: palette.parchmentB,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  details: {
    padding: theme.space(1.5),
  },
  name: {
    fontFamily: fonts.title,
    fontSize: 20,
    color: palette.ink,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.inkMuted,
    marginTop: 4,
  },
});

function ReadingModal({
  visible,
  onClose,
  hex,
  lines,
  variant = "primary",
  changingSummaries = [],
}) {
  if (!hex) return null;
  const essence = hex.essence || hex.judgment || "";
  const description = hex.description || hex.imageText || "";
  const diagramLines = Array.isArray(lines) ? lines : [];
  const showLines = diagramLines.length === 6;
  const showChanging =
    (variant === "primary" || variant === "library") &&
    changingSummaries.length > 0;

  return (
    <Modal visible={visible} animationType="slide">
      <GradientBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={stylesReading.container}>
            <Pressable onPress={onClose} style={stylesReading.closeButton}>
              <Ionicons name="chevron-back" size={22} color={palette.ink} />
            </Pressable>
            <View style={stylesReading.heroWrapper}>
              <View style={stylesReading.heroCircle}>
                <View style={stylesReading.heroCircleInner}>
                  {hex.imageUrl ? (
                    <Image
                      source={{ uri: hex.imageUrl }}
                      style={stylesReading.heroImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="sparkles-outline" size={36} color={palette.goldDeep} />
                  )}
                  <Svg
                    pointerEvents="none"
                    width={120}
                    height={120}
                    viewBox="0 0 100 100"
                    style={stylesReading.heroHexOverlay}
                  >
                    <Polygon
                      points={HEX_POINTS}
                      fill="transparent"
                      stroke={palette.gold}
                      strokeWidth={2}
                    />
                  </Svg>
                </View>
              </View>
            </View>
            <Text style={stylesReading.readingTitle}>{hex.name}</Text>
            {hex.nature ? <Text style={stylesReading.readingNature}>{hex.nature}</Text> : null}

            {showLines ? (
              <SectionCard style={stylesReading.linesCard}>
                <Text style={stylesReading.sectionHeader}>Lines</Text>
                <View style={stylesReading.linesDiagram}>
                  {[...diagramLines].reverse().map((line, index) => (
                    <Line key={index} v={line.v} moving={line.moving} />
                  ))}
                </View>
              </SectionCard>
            ) : null}

            {essence ? (
              <View style={stylesReading.sectionBlock}>
                <Text style={stylesReading.sectionHeader}>Essence</Text>
                <Text style={stylesReading.sectionText}>{essence}</Text>
              </View>
            ) : null}

            {description ? (
              <View style={stylesReading.sectionBlock}>
                <Text style={stylesReading.sectionHeader}>Description</Text>
                <Text style={stylesReading.sectionText}>{description}</Text>
              </View>
            ) : null}

            {showChanging ? (
              <View style={stylesReading.sectionBlock}>
                <Text style={stylesReading.sectionHeader}>Changing Lines</Text>
                {changingSummaries.map((item) => (
                  <View key={item.number} style={stylesReading.changingItem}>
                    <Text style={stylesReading.changingTitle}>{`Changing Line ${item.number}`}</Text>
                    <Text style={stylesReading.sectionText}>{item.text}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </GradientBackground>
    </Modal>
  );
}

const stylesReading = StyleSheet.create({
  container: {
    padding: theme.space(2),
    paddingBottom: theme.space(4),
    paddingTop: theme.space(2) + screenTopPadding,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    marginBottom: theme.space(1.5),
  },
  heroWrapper: {
    alignItems: "center",
    marginBottom: theme.space(2.5),
  },
  heroCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(247, 228, 176, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: palette.gold,
    shadowColor: palette.goldDeep,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  heroCircleInner: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  heroHexOverlay: {
    position: "absolute",
    top: 15,
    left: 15,
  },
  heroImage: {
    width: "210%",
    height: "210%",
    resizeMode: "cover",
  },
  readingTitle: {
    fontFamily: fonts.title,
    fontSize: 30,
    color: palette.ink,
    textAlign: "center",
  },
  readingNature: {
    fontFamily: fonts.body,
    color: palette.inkMuted,
    textAlign: "center",
    marginTop: 4,
    marginBottom: theme.space(2),
  },
  linesCard: {
    paddingVertical: theme.space(1.5),
  },
  linesDiagram: {
    marginTop: theme.space(1),
  },
  sectionBlock: {
    marginTop: theme.space(2),
  },
  sectionHeader: {
    fontFamily: fonts.title,
    fontSize: 18,
    color: palette.ink,
    marginBottom: 6,
  },
  sectionText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.ink,
    lineHeight: 24,
  },
  changingItem: {
    marginTop: theme.space(1),
    paddingTop: theme.space(1),
    borderTopWidth: 1,
    borderTopColor: palette.border,
  },
  changingTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: palette.goldDeep,
    marginBottom: 4,
  },
});

// ✨ Hero hexagon
function GlowingHexagon() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 2600,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2600,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const glowScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1.04],
  });
  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55, 0.92],
  });
  const coreOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1],
  });

  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        marginVertical: theme.space(3),
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 220,
          height: 220,
          borderRadius: 110,
          overflow: "hidden",
          opacity: glowOpacity,
          transform: [{ scale: glowScale }],
          shadowColor: "#f5d67a",
          shadowOpacity: 0.45,
          shadowRadius: 34,
          shadowOffset: { width: 0, height: 6 },
          elevation: 24,
        }}
      >
        <LinearGradient
          colors={["rgba(255, 225, 150, 0.85)", "rgba(255, 190, 86, 0.05)"]}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <Animated.View
        style={{
          opacity: coreOpacity,
          transform: [{ scale: glowScale }],
          shadowColor: "#b5771c",
          shadowOpacity: 0.3,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 14 },
          elevation: 16,
        }}
      >
        <Svg width={172} height={172} viewBox="0 0 100 100">
          <Defs>
            <SvgLinearGradient id="hex-core" x1="50%" y1="0%" x2="50%" y2="100%">
              <Stop offset="0%" stopColor="#fff5c4" stopOpacity="1" />
              <Stop offset="40%" stopColor="#ffd770" stopOpacity="0.95" />
              <Stop offset="100%" stopColor="#f3a42e" stopOpacity="1" />
            </SvgLinearGradient>
            <SvgLinearGradient id="hex-flare" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="rgba(255, 255, 255, 0.8)" />
              <Stop offset="55%" stopColor="rgba(255, 255, 255, 0.2)" />
              <Stop offset="100%" stopColor="rgba(255, 180, 70, 0.05)" />
            </SvgLinearGradient>
            <RadialGradient id="hex-inner" cx="50%" cy="45%" r="60%">
              <Stop offset="0%" stopColor="rgba(255, 255, 255, 0.92)" />
              <Stop offset="65%" stopColor="rgba(255, 211, 102, 0.35)" />
              <Stop offset="100%" stopColor="rgba(255, 191, 70, 0)" />
            </RadialGradient>
          </Defs>
          <Polygon points={HEX_POINTS} fill="url(#hex-core)" />
          <Polygon points={HEX_POINTS} fill="url(#hex-inner)" />
          <Polygon points={HEX_POINTS} fill="url(#hex-flare)" opacity="0.55" />
          <Polygon
            points={HEX_POINTS}
            stroke="rgba(255, 239, 190, 0.8)"
            strokeWidth={1.2}
            fill="none"
          />
          <Polygon
            points={HEX_POINTS}
            stroke="rgba(243, 164, 46, 0.45)"
            strokeWidth={2.1}
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

// 🏠 Home screen
function HomeScreen({ navigation, route }) {
  const [question, setQuestion] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const { session, profile, loadingProfile, signOut, refreshProfile } = useAuth();

  const hasProfile = Boolean(profile);
  const profileEmail = hasProfile
    ? profile.email || session?.user?.email || "Not set"
    : session?.user?.email || "Not set";
  const premiumStatusLabel = hasProfile
    ? profile.subscription_tier === "premium" || profile.is_premium
      ? "Premium"
      : profile.subscription_tier === "core"
      ? "Core"
      : "Core"
    : "Guest";

  useEffect(() => {
    if (route?.params?.resetQuestion) {
      setQuestion("");
      navigation.setParams({ resetQuestion: undefined });
    }
  }, [route?.params?.resetQuestion, navigation]);

  useEffect(() => {
    if (menuVisible) {
      refreshProfile();
    }
  }, [menuVisible, refreshProfile]);

  const closeMenuAndNavigate = useCallback(
    (target) => {
      setMenuVisible(false);
      if (target) {
        requestAnimationFrame(() => navigation.navigate(target));
      }
    },
    [navigation]
  );

  const handleOpenGuide = useCallback(() => closeMenuAndNavigate("Guide"), [closeMenuAndNavigate]);
  const handleOpenSettings = useCallback(() => closeMenuAndNavigate("Settings"), [closeMenuAndNavigate]);
  const handleOpenPremium = useCallback(() => closeMenuAndNavigate("Premium"), [closeMenuAndNavigate]);

  const handleLogout = useCallback(async () => {
    setMenuVisible(false);
    try {
      setQuestion("");
      await signOut();
    } catch (error) {
      Alert.alert("Logout failed", error?.message || "Please try again.");
    }
  }, [signOut]);

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={stylesHome.container}
            keyboardShouldPersistTaps="handled"
          >
            <View style={stylesHome.headerRow}>
              <Pressable
                onPress={() => setMenuVisible(true)}
                style={stylesHome.menuButton}
                hitSlop={8}
              >
                <Ionicons name="ellipsis-vertical" size={22} color={palette.ink} />
              </Pressable>
            </View>
            <View style={stylesHome.mainContent}>
              <View style={stylesHome.heroBlock}>
                <Text style={stylesHome.appTitle}>AI Ching Insights</Text>
                <GlowingHexagon />
                <Text style={stylesHome.subtitle}>
                  The oracle awaits with quiet truths and timeless wisdom
                </Text>
              </View>

              <View style={stylesHome.formBlock}>
                <Text style={stylesHome.prompt}>What question brings you here today?</Text>
                <TextInput
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                  maxLength={150}
                  placeholder="Ask with sincerity…"
                  placeholderTextColor={palette.inkMuted}
                  style={stylesHome.input}
                />
                <Text style={stylesHome.counter}>{question.length}/150</Text>

                <GoldButton
                  full
                  onPress={() =>
                    navigation.navigate("Cast", { question: question?.trim() || null })
                  }
                  icon={<Ionicons name="sparkles-outline" size={18} color={palette.white} />}
                >
                  Submit
                </GoldButton>
              </View>
            </View>
          </ScrollView>
          <Modal
            visible={menuVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setMenuVisible(false)}
          >
            <Pressable
              style={stylesHome.menuOverlay}
              onPress={() => setMenuVisible(false)}
            >
              <Pressable
                style={stylesHome.menuCard}
                onPress={(event) => event.stopPropagation()}
              >
                <Text style={stylesHome.menuTitle}>Account</Text>
                {loadingProfile ? (
                  <Text style={stylesHome.menuValue}>Loading profile…</Text>
                ) : (
                  <>
                    <Text style={stylesHome.menuLabel}>Email</Text>
                    <Text style={stylesHome.menuValue}>{profileEmail}</Text>
                    <Text style={stylesHome.menuLabel}>Premium Status</Text>
                    <Text style={stylesHome.menuValue}>{premiumStatusLabel}</Text>
                    {!hasProfile ? (
                      <Text style={stylesHome.menuHint}>
                        No profile record found for this account.
                      </Text>
                    ) : null}
                  </>
                )}
                <View style={stylesHome.menuDivider} />
                <Pressable style={stylesHome.menuOption} onPress={handleOpenGuide}>
                  <Ionicons name="book-outline" size={18} color={palette.goldDeep} />
                  <Text style={stylesHome.menuOptionText}>Guide</Text>
                </Pressable>
                <Pressable style={stylesHome.menuOption} onPress={handleOpenSettings}>
                  <Ionicons name="settings-outline" size={18} color={palette.goldDeep} />
                  <Text style={stylesHome.menuOptionText}>Settings</Text>
                </Pressable>
                <Pressable style={stylesHome.menuOption} onPress={handleOpenPremium}>
                  <Ionicons name="diamond-outline" size={18} color={palette.goldDeep} />
                  <Text style={stylesHome.menuOptionText}>Premium</Text>
                </Pressable>
                <View style={stylesHome.menuDivider} />
                <GoldButton
                  full
                  kind="secondary"
                  onPress={handleLogout}
                  icon={<Ionicons name="log-out-outline" size={18} color={palette.gold} />}
                >
                  Logout
                </GoldButton>
              </Pressable>
            </Pressable>
          </Modal>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const stylesHome = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: theme.space(2.5),
    paddingTop: theme.space(2.5) + screenTopPadding,
  },
  headerRow: {
    alignItems: "flex-end",
    paddingTop: screenTopPadding,
  },
  mainContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingBottom: theme.space(3),
  },
  heroBlock: {
    alignItems: "center",
  },
  formBlock: {
    marginTop: theme.space(3),
  },
  appTitle: {
    fontFamily: fonts.title,
    fontSize: 34,
    color: palette.ink,
    marginTop: 0,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.inkMuted,
    textAlign: "center",
    marginTop: theme.space(1),
    marginBottom: theme.space(2),
    paddingHorizontal: theme.space(2),
    lineHeight: 22,
  },
  prompt: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.ink,
    marginBottom: 6,
    textAlign: "center",
  },
  input: {
    minHeight: 64,
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    padding: theme.space(1.5),
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.ink,
  },
  counter: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: palette.inkMuted,
    textAlign: "right",
    marginTop: 4,
  },
  menuButton: {
    padding: theme.space(0.5),
    alignSelf: "flex-end",
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    padding: theme.space(2.5),
  },
  menuCard: {
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    padding: theme.space(2),
    shadowColor: palette.ink,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  menuTitle: {
    fontFamily: fonts.title,
    fontSize: 20,
    color: palette.ink,
    marginBottom: theme.space(1.5),
  },
  menuLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: palette.ink,
    marginTop: theme.space(1),
  },
  menuValue: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.ink,
    marginTop: 4,
  },
  menuHint: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.inkMuted,
    marginTop: theme.space(1),
  },
  menuDivider: {
    marginVertical: theme.space(2),
    height: 1,
    backgroundColor: palette.border,
  },
  menuOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: theme.space(0.5),
  },
  menuOptionText: {
    marginLeft: theme.space(1),
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.ink,
  },
});

// 🎴 Cast screen
function CastScreen({ route, navigation }) {
  const { isPremium } = useAuth();
  const premiumMember = Boolean(isPremium);
  const question = route.params?.question ?? null;
  const [all, setAll] = useState([]);
  const [lines, setLines] = useState([]);
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    loadHexagrams().then(setAll);
  }, []);

  const handleCastLine = () => {
    if (lines.length >= 6) return;
    const newLine = randomLine();
    setLines((prev) => {
      const next = [...prev, newLine];
      if (next.length === 6) setIsDone(true);
      return next;
    });
  };

  const resultingLines = useMemo(
    () => (lines.length === 6 ? flipLinesForResult(lines) : []),
    [lines]
  );
  const primaryHex = useMemo(
    () => (lines.length === 6 ? chooseByLines(lines, all) : null),
    [lines, all]
  );
  const resultingHex = useMemo(
    () => (lines.length === 6 ? chooseByLines(resultingLines, all) : null),
    [resultingLines, all]
  );

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.space(2.5),
            paddingBottom: theme.space(3),
            paddingTop: theme.space(2.5) + screenTopPadding,
          }}
        >
          <Text style={stylesCast.sectionTitle}>Casting</Text>
          {question ? (
            <>
              <Text style={stylesCast.subText}>Question</Text>
              <View style={stylesCast.questionBox}>
                <Text style={stylesCast.questionText}>{question}</Text>
              </View>
            </>
          ) : null}

          <SectionCard>
            <Text style={stylesCast.sectionHeader}>Lines</Text>
            <View style={{ marginTop: 6 }}>
              {[...Array(6)].map((_, topIdx) => {
                const storeIdx = 5 - topIdx;
                const line = lines[storeIdx];
                if (!line) {
                  return <View key={topIdx} style={{ height: 22, marginVertical: 5 }} />;
                }
                return (
                  <AnimatedLine
                    key={topIdx}
                    v={line.v}
                    moving={line.moving}
                    delay={topIdx * 100}
                  />
                );
              })}
            </View>
            {!isDone ? (
              <GoldButton
                onPress={handleCastLine}
                icon={<Ionicons name="hand-left-outline" size={18} color={palette.white} />}
              >
                Cast Line {lines.length + 1}/6
              </GoldButton>
            ) : null}
          </SectionCard>

          {!isDone && lines.length === 0 ? (
            premiumMember ? (
              <GoldButton
                full
                kind="secondary"
                onPress={() =>
                  navigation.navigate("ManualCasting", {
                    question,
                  })
                }
                icon={<Ionicons name="keypad-outline" size={18} color={palette.gold} />}
              >
                Manual Casting
              </GoldButton>
            ) : (
              <UpgradeCallout
                title="Manual casting is a Premium ritual"
                description={
                  "Unlock tactile casting methods, AI summaries, and deeper insights with Premium for £2.99 per month."
                }
                onUpgrade={() => navigation.navigate("Premium")}
                icon="keypad-outline"
              />
            )
          ) : null}

          {isDone ? (
            <GoldButton
              kind="secondary"
              onPress={() =>
                navigation.replace("Results", {
                  question,
                  primary: primaryHex,
                  resulting: resultingHex,
                  primaryLines: lines,
                  resultingLines,
                })
              }
              icon={<Ionicons name="book-outline" size={18} color={palette.gold} />}
            >
              View Results
            </GoldButton>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function ManualCastingScreen({ route, navigation }) {
  const { isPremium } = useAuth();
  const premiumMember = Boolean(isPremium);
  const question = route.params?.question ?? null;
  const [inputs, setInputs] = useState(["", "", "", "", "", ""]);
  const [hexagrams, setHexagrams] = useState([]);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!premiumMember) return;
    loadHexagrams().then(setHexagrams);
  }, [premiumMember]);

  if (!premiumMember) {
    return (
      <GradientBackground>
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: theme.space(2.5),
              paddingBottom: theme.space(3),
              paddingTop: theme.space(2.5) + screenTopPadding,
            }}
          >
            <UpgradeCallout
              title="Manual casting requires Premium"
              description="Experience the full ritual of the I Ching with manual casting, AI-guided summaries, and advanced analytics when you upgrade."
              onUpgrade={() => navigation.navigate("Premium")}
              icon="sparkles-outline"
            />
          </ScrollView>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const manualLines = useMemo(
    () => inputs.map((value) => lineFromManualValue(value)),
    [inputs]
  );

  const isComplete = manualLines.every((line) => line);

  const handleChange = (index, text) => {
    let value = text.replace(/[^0-9]/g, "");
    if (value.length > 1) value = value.slice(-1);
    if (!["6", "7", "8", "9"].includes(value)) {
      value = "";
    }
    setInputs((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    if (value && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleViewResult = () => {
    if (!isComplete) return;
    const resulting = flipLinesForResult(manualLines);
    const primaryHex = chooseByLines(manualLines, hexagrams);
    const resultingHex = chooseByLines(resulting, hexagrams);
    navigation.replace("Results", {
      question,
      primary: primaryHex,
      resulting: resultingHex,
      primaryLines: manualLines,
      resultingLines: resulting,
    });
  };

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <SafeAreaView style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={stylesManual.container}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              onPress={() => navigation.goBack()}
              style={stylesManual.backButton}
            >
              <Ionicons name="chevron-back" size={20} color={palette.ink} />
              <Text style={stylesManual.backLabel}>Back</Text>
            </Pressable>

            <Text style={stylesManual.title}>Manual Casting</Text>
            <Text style={stylesManual.subtitle}>
              Enter six values (6, 7, 8, or 9) to form your hexagram lines.
            </Text>

            {question ? (
              <View style={stylesManual.questionBox}>
                <Text style={stylesManual.questionLabel}>Question</Text>
                <Text style={stylesManual.questionText}>{question}</Text>
              </View>
            ) : null}

            <SectionCard>
              <Text style={stylesManual.sectionHeader}>Lines</Text>
              <View style={{ marginTop: 6 }}>
                {[...Array(6)].map((_, topIdx) => {
                  const storeIdx = 5 - topIdx;
                  const line = manualLines[storeIdx];
                  if (!line) {
                    return (
                      <View key={topIdx} style={{ height: 22, marginVertical: 5 }} />
                    );
                  }
                  return <Line key={topIdx} v={line.v} moving={line.moving} />;
                })}
              </View>
              <Text style={stylesManual.helperText}>Use 6 or 9 for moving lines.</Text>
            </SectionCard>

            <View style={stylesManual.inputsRow}>
              {inputs.map((value, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  value={value}
                  onChangeText={(text) => handleChange(index, text)}
                  keyboardType="number-pad"
                  maxLength={1}
                  placeholder="-"
                  placeholderTextColor={palette.inkMuted}
                  style={stylesManual.input}
                  returnKeyType={index === inputs.length - 1 ? "done" : "next"}
                />
              ))}
            </View>

            {isComplete ? (
              <GoldButton
                full
                kind="secondary"
                onPress={handleViewResult}
                icon={<Ionicons name="book-outline" size={18} color={palette.gold} />}
              >
                View Result
              </GoldButton>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const stylesCast = StyleSheet.create({
  sectionTitle: {
    fontFamily: fonts.title,
    fontSize: 26,
    color: palette.ink,
    marginBottom: 12,
  },
  subText: {
    fontFamily: fonts.body,
    color: palette.inkMuted,
    marginBottom: 6,
  },
  questionBox: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: theme.radius,
    padding: theme.space(1.5),
    marginBottom: theme.space(1),
  },
  questionText: {
    fontFamily: fonts.body,
    color: palette.ink,
  },
  sectionHeader: {
    fontFamily: fonts.title,
    fontSize: 18,
    color: palette.ink,
    marginBottom: 6,
  },
});

const stylesManual = StyleSheet.create({
  container: {
    padding: theme.space(2.5),
    paddingBottom: theme.space(4),
    paddingTop: theme.space(2.5) + screenTopPadding,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: theme.space(1),
    paddingVertical: 6,
    marginBottom: theme.space(1.5),
  },
  backLabel: {
    marginLeft: 6,
    fontFamily: fonts.body,
    color: palette.ink,
    fontSize: 14,
  },
  title: {
    fontFamily: fonts.title,
    fontSize: 26,
    color: palette.ink,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.inkMuted,
    marginTop: 6,
    marginBottom: theme.space(2),
    lineHeight: 22,
  },
  questionBox: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: theme.radius,
    padding: theme.space(1.5),
    marginBottom: theme.space(2),
  },
  questionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: palette.ink,
    marginBottom: 6,
  },
  questionText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.ink,
    lineHeight: 22,
  },
  sectionHeader: {
    fontFamily: fonts.title,
    fontSize: 18,
    color: palette.ink,
  },
  helperText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.inkMuted,
    marginTop: theme.space(1),
  },
  inputsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: theme.space(1.5),
    marginBottom: theme.space(2.5),
  },
  input: {
    width: 48,
    height: 54,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.white,
    textAlign: "center",
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    color: palette.ink,
  },
});

// 🧘 Results screen
function ResultsScreen({ navigation, route }) {
  const { question, primary, resulting, primaryLines, resultingLines } =
    route.params || {};
  const [tab, setTab] = useState("Primary");
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState(null);
  const { addEntry } = useJournal();

  const openReading = (hex, lines, variant) => {
    if (!hex) return;
    const changingSummaries =
      variant === "primary" ? deriveChangingLineSummaries(hex, lines || []) : [];
    setSelected({ hex, lines, variant, changingSummaries });
    setShow(true);
  };

  const handleJournal = async () => {
    if (!primary) {
      Alert.alert("Still casting", "Complete the casting before journaling.");
      return;
    }
    const newId = await addEntry({
      question,
      primary,
      resulting,
      primaryLines,
      resultingLines,
    });
    if (!newId) {
      return;
    }
    navigation.popToTop();
    const parent = navigation.getParent();
    if (parent) {
      parent.navigate("Journal", {
        screen: "JournalList",
        params: { focusId: newId },
      });
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.space(2.5),
            paddingBottom: theme.space(3),
            paddingTop: theme.space(2.5) + screenTopPadding,
          }}
        >
          <Text style={stylesResults.sectionTitle}>Results</Text>
          {question ? (
            <>
              <Text style={stylesResults.subText}>Question</Text>
              <View style={stylesResults.questionBox}>
                <Text style={stylesResults.questionText}>{question}</Text>
              </View>
            </>
          ) : null}

          <View style={stylesResults.tabs}>
            {["Primary", "Resulting"].map((tabName) => {
              const active = tab === tabName;
              return (
                <Pressable
                  key={tabName}
                  onPress={() => setTab(tabName)}
                  style={[stylesResults.tabBtn, active && { backgroundColor: palette.gold }]}
                >
                  <Text style={[stylesResults.tabText, active && { color: palette.white }]}>
                    {tabName}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {tab === "Primary" ? (
            <HexagramCard
              item={primary}
              onPress={() => openReading(primary, primaryLines, "primary")}
            />
          ) : (
            <HexagramCard
              item={resulting}
              onPress={() => openReading(resulting, resultingLines, "resulting")}
            />
          )}

          {primary ? (
            <GoldButton
              full
              onPress={handleJournal}
              icon={<Ionicons name="create-outline" size={18} color={palette.white} />}
            >
              Add to Journal
            </GoldButton>
          ) : null}

          <ReadingModal
            visible={show}
            onClose={() => setShow(false)}
            hex={selected?.hex}
            lines={selected?.lines || []}
            variant={selected?.variant}
            changingSummaries={selected?.changingSummaries || []}
          />
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const stylesResults = StyleSheet.create({
  sectionTitle: {
    fontFamily: fonts.title,
    fontSize: 26,
    color: palette.ink,
    marginBottom: 12,
  },
  subText: {
    fontFamily: fonts.body,
    color: palette.inkMuted,
    marginBottom: 6,
  },
  questionBox: {
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: theme.radius,
    padding: theme.space(1.5),
    marginBottom: theme.space(1),
  },
  questionText: {
    fontFamily: fonts.body,
    color: palette.ink,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 4,
    marginBottom: theme.space(1.5),
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: theme.radius,
  },
  tabText: {
    fontFamily: fonts.body,
    color: palette.inkMuted,
  },
});

// 📚 Library screen
function LibraryScreen() {
  const [hexagrams, setHexagrams] = useState([]);
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const { width } = useWindowDimensions();

  useEffect(() => {
    let active = true;
    loadHexagrams()
      .then((data) => {
        if (!active) return;
        const ordered = (data || [])
          .filter((item) => {
            const number = item?.number;
            return typeof number === "number" && number >= 1 && number <= 64;
          })
          .sort((a, b) => (a.number || 0) - (b.number || 0));
        console.log("Library hexagrams prepared:", ordered.length);
        setHexagrams(ordered);
      })
      .catch((error) => console.log("Library load error:", error));
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return hexagrams;
    return hexagrams.filter((item) => {
      const name = item?.name?.toLowerCase() || "";
      const number = item?.number ? String(item.number) : "";
      return name.includes(term) || number.includes(term);
    });
  }, [hexagrams, search]);

  const openHexagram = (hex) => {
    if (!hex) return;
    const summaries = fullChangingLineSummaries(hex);
    setSelected({ hex, summaries });
    setShow(true);
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={stylesLibrary.container}>
          <View style={stylesLibrary.content}>
            <View style={stylesLibrary.header}>
              <Text style={stylesLibrary.title}>Library</Text>
              <Text style={stylesLibrary.subtitle}>
                Explore each of the 64 hexagrams at your own pace.
              </Text>
            </View>
            <View style={stylesLibrary.searchBar}>
              <Ionicons name="search" size={18} color={palette.inkMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name or number"
                placeholderTextColor={palette.inkMuted}
                style={stylesLibrary.searchInput}
              />
            </View>
            <View style={stylesLibrary.carouselWrapper}>
              <FlatList
                data={filtered}
                keyExtractor={(item) => `${item.number || item.name}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={stylesLibrary.flatList}
                contentContainerStyle={stylesLibrary.listContent}
                renderItem={({ item }) => (
                  <View
                    style={[
                      stylesLibrary.cardSlot,
                      { width: Math.max(240, width - theme.space(5)) },
                    ]}
                  >
                    <HexagramCard
                      item={item}
                      onPress={() => openHexagram(item)}
                    />
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={stylesLibrary.loadingText}>
                    {hexagrams.length && search.trim()
                      ? "No matches found."
                      : "Loading library…"}
                  </Text>
                }
              />
            </View>
          </View>
        </View>
        <ReadingModal
          visible={show}
          onClose={() => setShow(false)}
          hex={selected?.hex}
          lines={[]}
          variant="library"
          changingSummaries={selected?.summaries || []}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

const stylesLibrary = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.space(2.5),
    paddingBottom: theme.space(3),
    paddingTop: theme.space(2.5) + screenTopPadding,
  },
  content: {
    flex: 1,
  },
  header: {
    marginBottom: theme.space(3),
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: theme.space(1.5),
    paddingVertical: 10,
    marginBottom: theme.space(2),
  },
  searchInput: {
    marginLeft: theme.space(1),
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.ink,
    flex: 1,
  },
  title: {
    fontFamily: fonts.title,
    fontSize: 26,
    color: palette.ink,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.inkMuted,
  },
  carouselWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  flatList: {
    flexGrow: 0,
  },
  listContent: {
    paddingHorizontal: theme.space(0.5),
    paddingVertical: theme.space(1),
  },
  cardSlot: {
    marginRight: theme.space(1.75),
  },
  loadingText: {
    fontFamily: fonts.body,
    color: palette.inkMuted,
  },
});

// 📝 Journal list
const formatDate = (date) => {
  try {
    return date.toLocaleString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch (error) {
    return "";
  }
};

function JournalListScreen({ navigation, route }) {
  const { entries, confirmDelete } = useJournal();
  const [search, setSearch] = useState("");
  const [highlightId, setHighlightId] = useState(null);
  const listRef = useRef(null);

  const goHome = () => {
    const tabNav = navigation.getParent();
    if (tabNav) {
      tabNav.navigate("Home", {
        screen: "HomeRoot",
        params: { resetQuestion: true },
      });
    }
  };

  useEffect(() => {
    const focusId = route?.params?.focusId;
    if (focusId) {
      setHighlightId(focusId);
      if (listRef.current) {
        listRef.current.scrollToOffset({ offset: 0, animated: true });
      }
      navigation.setParams({ focusId: undefined });
      const timeout = setTimeout(() => setHighlightId(null), 2000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [route?.params?.focusId, navigation]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      return (
        entry.question?.toLowerCase().includes(term) ||
        entry.primary?.name?.toLowerCase().includes(term) ||
        entry.resulting?.name?.toLowerCase().includes(term)
      );
    });
  }, [entries, search]);

  const renderItem = ({ item }) => {
    const questionText = item.question?.trim()
      ? item.question.trim()
      : item.primary?.name || "Untitled Reading";
    const primaryLine = item.primary
      ? `Primary · Hexagram ${item.primary.number ?? "--"} · ${item.primary.name ?? "Unknown"}`
      : "Primary hexagram unavailable";
    const highlight = item.id === highlightId;

    return (
      <Pressable
        onPress={() => navigation.navigate("JournalDetail", { id: item.id })}
        style={({ pressed }) => [
          stylesJournal.row,
          highlight && stylesJournal.rowHighlight,
          pressed && { opacity: 0.92 },
        ]}
      >
        <HexagonThumbnail uri={item.primary?.imageUrl} />
        <View style={stylesJournal.rowContent}>
          <Text style={stylesJournal.rowTitle} numberOfLines={2}>
            {questionText}
          </Text>
          <Text style={stylesJournal.rowMeta} numberOfLines={1}>
            {primaryLine}
          </Text>
          <Text style={stylesJournal.rowDate}>{formatDate(item.createdAt)}</Text>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            confirmDelete(item.id);
          }}
          hitSlop={8}
          style={({ pressed }) => [stylesJournal.deleteButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="trash-outline" size={20} color={palette.goldDeep} />
        </Pressable>
      </Pressable>
    );
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={stylesJournal.container}>
          <Text style={stylesJournal.title}>Journal</Text>
          <View style={stylesJournal.searchBar}>
            <Ionicons name="search" size={18} color={palette.inkMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search"
              placeholderTextColor={palette.inkMuted}
              style={stylesJournal.searchInput}
            />
          </View>
          <FlatList
            ref={listRef}
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: theme.space(1) }} />}
            style={stylesJournal.list}
            contentContainerStyle={stylesJournal.listContent}
            ListEmptyComponent={
              <View style={stylesJournal.emptyState}>
                <Ionicons name="book-outline" size={48} color={palette.gold} />
                <Text style={stylesJournal.emptyTitle}>No entries yet</Text>
                <Text style={stylesJournal.emptyBody}>
                  Save a reading from the Results screen to begin your journal.
                </Text>
              </View>
            }
          />
          <GoldButton
            full
            onPress={goHome}
            icon={<Ionicons name="sparkles-outline" size={18} color={palette.white} />}
          >
            Ask Another Question
          </GoldButton>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const stylesJournal = StyleSheet.create({
  container: {
    flex: 1,
    padding: theme.space(2.5),
    paddingTop: theme.space(2.5) + screenTopPadding,
  },
  title: {
    fontFamily: fonts.title,
    fontSize: 26,
    color: palette.ink,
    marginBottom: theme.space(2),
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: theme.space(1.5),
    paddingVertical: 10,
    marginBottom: theme.space(2),
  },
  searchInput: {
    marginLeft: theme.space(1),
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.ink,
    flex: 1,
  },
  list: {
    flex: 1,
    alignSelf: "stretch",
  },
  listContent: {
    paddingBottom: theme.space(4),
    flexGrow: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    padding: theme.space(1.5),
  },
  rowHighlight: {
    borderColor: palette.gold,
    backgroundColor: "#FDF7E8",
  },
  rowContent: {
    flex: 1,
    marginLeft: theme.space(1.5),
  },
  rowTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.ink,
    marginBottom: 2,
  },
  rowMeta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.inkMuted,
    marginBottom: 2,
  },
  rowDate: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.inkMuted,
  },
  deleteButton: {
    padding: theme.space(0.5),
  },
  emptyState: {
    alignItems: "center",
    marginTop: theme.space(6),
  },
  emptyTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: palette.ink,
    marginTop: theme.space(1),
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.inkMuted,
    textAlign: "center",
    marginTop: theme.space(1),
    paddingHorizontal: theme.space(2),
  },
});

// 🗒️ Journal detail
const wordCount = (text) => {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
};

function JournalDetailScreen({ route, navigation }) {
  const { id } = route.params || {};
  const { session, isPremium: premiumStatus } = useAuth();
  const userId = session?.user?.id;
  const { entries, updateEntryNote, setEntryAiSummary, fetchEntryAiSummary } =
    useJournal();
  const entry = useMemo(() => entries.find((item) => item.id === id), [entries, id]);
  const [note, setNote] = useState(entry?.note || "");
  const [limitReached, setLimitReached] = useState(false);
  const [modal, setModal] = useState(null);
  const [aiSummary, setAiSummary] = useState(entry?.aiSummary || "");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [hasRequestedInsight, setHasRequestedInsight] = useState(
    Boolean(entry?.aiSummary)
  );
  const [summaryExpanded, setSummaryExpanded] = useState(false);
  const premiumMember = Boolean(premiumStatus);
  const [aiUsageCount, setAiUsageCount] = useState(0);
  const [aiUsageLoading, setAiUsageLoading] = useState(false);
  const premiumMonthlyLimit = 100;

  useEffect(() => {
    if (!entry) {
      Alert.alert("Not found", "This journal entry was removed.", [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ]);
    }
  }, [entry, navigation]);

  useEffect(() => {
    if (entry) {
      setNote(entry.note || "");
      setAiSummary(entry.aiSummary || "");
      setHasRequestedInsight(Boolean(entry.aiSummary));
      setSummaryExpanded(false);
    }
  }, [entry?.note, entry?.aiSummary, entry?.id]);

  useEffect(() => {
    if (!premiumMember || !userId) return;
    let active = true;
    const loadUsage = async () => {
      setAiUsageLoading(true);
      try {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { count, error } = await supabase
          .from("JournalEntries")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .not("ai_summary", "is", null)
          .gte("created_at", startOfMonth.toISOString());
        if (error) throw error;
        if (active) {
          setAiUsageCount(count || 0);
        }
      } catch (usageError) {
        console.log("AI usage count error:", usageError?.message || usageError);
      } finally {
        if (active) {
          setAiUsageLoading(false);
        }
      }
    };
    loadUsage();
    return () => {
      active = false;
    };
  }, [premiumMember, userId, entry?.id]);

  if (!entry) {
    return null;
  }

  const handleNoteChange = (text) => {
    const count = wordCount(text);
    if (count > 1000) {
      setLimitReached(true);
      return;
    }
    setLimitReached(false);
    setNote(text);
    updateEntryNote(entry.id, text);
  };

  const openReading = (hex, lines, variant) => {
    if (!hex) return;
    const changingSummaries =
      variant === "primary" ? deriveChangingLineSummaries(hex, lines || []) : [];
    setModal({ hex, lines, variant, changingSummaries });
  };

  const handleAiInsight = async () => {
    // Prevent duplicate requests while the oracle is already being consulted
    if (summaryLoading) return;

    // Require authentication before invoking the oracle
    if (!userId || !entry?.id) {
      Alert.alert("Sign in required", "Log in to request an oracle insight.");
      return;
    }

    if (!premiumMember) {
      Alert.alert(
        "Premium required",
        "Upgrade to Premium to receive monthly AI oracle insights."
      );
      navigation.navigate("Premium");
      return;
    }

    if (premiumMember && aiUsageCount >= premiumMonthlyLimit) {
      Alert.alert(
        "Monthly limit reached",
        "You have used all 100 Premium AI insights this month."
      );
      return;
    }

    if (premiumMember && aiUsageLoading) {
      Alert.alert(
        "Please wait",
        "Checking your remaining AI insight allowance."
      );
      return;
    }

    setSummaryError("");
    setSummaryLoading(true);

    try {
      // Reuse any cached AI insight before making a new request
      let summaryText = aiSummary || entry.aiSummary || "";
      let generatedFresh = false;

      if (!summaryText) {
        try {
          summaryText = await fetchEntryAiSummary(entry.id);
        } catch (lookupError) {
          console.log(
            "AI summary lookup error:",
            lookupError?.message || lookupError
          );
        }
      }

      if (!summaryText) {
        const payload = { entry_id: entry.id, user_id: userId };
        console.log("Invoking AI summary with payload:", payload);

        const accessToken = session?.access_token || SUPABASE_ANON_KEY;
        if (!accessToken) {
          throw new Error("Missing access token");
        }

        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/ai_summary`,
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
              apikey: SUPABASE_ANON_KEY,
            },
            body: JSON.stringify(payload),
          }
        );

        const raw = await response.text();
        let data = {};
        try {
          data = raw ? JSON.parse(raw) : {};
        } catch (parseError) {
          console.log("AI summary parse error:", raw);
          throw new Error("Unexpected response from oracle");
        }

        console.log("AI summary response status:", response.status);
        console.log("AI summary data:", data);

        summaryText = data?.summary || data?.message || "";

        if (!response.ok || !summaryText) {
          throw new Error(data?.error || "Unable to receive insight.");
        }

        Alert.alert("Insight received!", "Your AI oracle summary is ready.");
        generatedFresh = true;
      }

      setSummaryError("");
      setAiSummary(summaryText);
      setEntryAiSummary(entry.id, summaryText);
      setHasRequestedInsight(true);
      setSummaryExpanded(false);
      if (generatedFresh) {
        setAiUsageCount((prev) => {
          const next = (prev || 0) + 1;
          return next > premiumMonthlyLimit ? premiumMonthlyLimit : next;
        });
      }
    } catch (error) {
      console.log("AI summary error:", error?.message || error);
      setSummaryError("Unable to receive insight. Please try again.");
      Alert.alert("Unable to receive insight. Please try again.");
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={stylesDetail.container}
        >
          <Pressable onPress={() => navigation.goBack()} style={stylesDetail.backButton}>
            <Ionicons name="chevron-back" size={20} color={palette.ink} />
            <Text style={stylesDetail.backLabel}>Back</Text>
          </Pressable>
          <Text style={stylesDetail.title}>Journal Entry</Text>
          <Text style={stylesDetail.timestamp}>{formatDate(entry.createdAt)}</Text>

          {entry.question ? (
            <View style={stylesDetail.questionBox}>
              <Text style={stylesDetail.questionLabel}>Question</Text>
              <Text style={stylesDetail.questionText}>{entry.question}</Text>
            </View>
          ) : null}

          <View style={stylesDetail.hexList}>
            <View style={stylesDetail.hexRow}>
              <HexagonThumbnail uri={entry.primary?.imageUrl} size={60} />
              <View style={stylesDetail.hexContent}>
                <Text style={stylesDetail.hexTitle}>{entry.primary?.name || "Primary"}</Text>
                <Text style={stylesDetail.hexSubtitle}>
                  Hexagram {entry.primary?.number ?? "--"}
                </Text>
              </View>
              <Text
                style={stylesDetail.viewLink}
                onPress={() => openReading(entry.primary, entry.primaryLines, "primary")}
              >
                View
              </Text>
            </View>
            <View style={stylesDetail.hexRow}>
              <HexagonThumbnail uri={entry.resulting?.imageUrl} size={60} />
              <View style={stylesDetail.hexContent}>
                <Text style={stylesDetail.hexTitle}>{entry.resulting?.name || "Resulting"}</Text>
                <Text style={stylesDetail.hexSubtitle}>
                  Hexagram {entry.resulting?.number ?? "--"}
                </Text>
              </View>
              <Text
                style={stylesDetail.viewLink}
                onPress={() => openReading(entry.resulting, entry.resultingLines, "resulting")}
              >
                View
              </Text>
            </View>
          </View>

          <Text style={stylesDetail.noteLabel}>Note</Text>
          <TextInput
            value={note}
            onChangeText={handleNoteChange}
            placeholder="Write a note..."
            placeholderTextColor={palette.inkMuted}
            multiline
            textAlignVertical="top"
            style={stylesDetail.noteInput}
          />
          <Text style={stylesDetail.wordCount}>
            {wordCount(note)}/1000 words{limitReached ? " • Limit reached" : ""}
          </Text>

          {premiumMember ? (
            <>
              <GoldButton
                full
                onPress={handleAiInsight}
                disabled={summaryLoading || aiUsageCount >= premiumMonthlyLimit}
                icon={<Ionicons name="sparkles-outline" size={18} color={palette.white} />}
              >
                AI Oracle Insight
              </GoldButton>
              <Text style={stylesDetail.aiQuotaText}>
                {aiUsageLoading
                  ? "Checking your monthly insight allowance…"
                  : `${aiUsageCount}/${premiumMonthlyLimit} insights used this month`}
              </Text>
              {aiUsageCount >= premiumMonthlyLimit ? (
                <Text style={stylesDetail.aiLimitText}>
                  Monthly limit reached. New insights unlock next month.
                </Text>
              ) : null}
            </>
          ) : (
            <UpgradeCallout
              title="Invite the AI Oracle"
              description={
                "Premium members receive up to 100 personalised AI summaries every month. Upgrade to unlock this guidance."
              }
              onUpgrade={() => navigation.navigate("Premium")}
              icon="sparkles-outline"
            />
          )}

          {summaryLoading ? (
            <View style={stylesDetail.aiCard}>
              <ActivityIndicator color={palette.goldDeep} size="small" />
              <Text style={stylesDetail.aiStatus}>Consulting the Oracle…</Text>
            </View>
          ) : null}

          {!summaryLoading && summaryError ? (
            <View style={[stylesDetail.aiCard, stylesDetail.aiErrorCard]}>
              <Text style={stylesDetail.aiErrorText}>{summaryError}</Text>
            </View>
          ) : null}

          {!summaryLoading && hasRequestedInsight && aiSummary ? (
            <View style={stylesDetail.aiCard}>
              <Text style={stylesDetail.aiCardTitle}>AI Oracle Insight</Text>
              <Text
                style={stylesDetail.aiCardText}
                numberOfLines={summaryExpanded ? undefined : 6}
              >
                {aiSummary}
              </Text>
              {aiSummary ? (
                <Pressable
                  onPress={() => setSummaryExpanded((prev) => !prev)}
                  style={stylesDetail.aiToggle}
                >
                  <Text style={stylesDetail.aiToggleText}>
                    {summaryExpanded ? "Read less" : "Read more"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
        <ReadingModal
          visible={!!modal}
          onClose={() => setModal(null)}
          hex={modal?.hex}
          lines={modal?.lines || []}
          variant={modal?.variant}
          changingSummaries={modal?.changingSummaries || []}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

const stylesDetail = StyleSheet.create({
  container: {
    padding: theme.space(2.5),
    paddingBottom: theme.space(4),
    paddingTop: theme.space(2.5) + screenTopPadding,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: theme.space(1),
    paddingVertical: 6,
    marginBottom: theme.space(1.5),
  },
  backLabel: {
    marginLeft: 6,
    fontFamily: fonts.body,
    color: palette.ink,
    fontSize: 14,
  },
  title: {
    fontFamily: fonts.title,
    fontSize: 26,
    color: palette.ink,
  },
  timestamp: {
    fontFamily: fonts.body,
    color: palette.inkMuted,
    marginTop: 4,
    marginBottom: theme.space(2),
  },
  questionBox: {
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    padding: theme.space(1.5),
    marginBottom: theme.space(2),
  },
  questionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: palette.ink,
    marginBottom: 6,
  },
  questionText: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.ink,
    lineHeight: 22,
  },
  hexList: {
    marginBottom: theme.space(2),
  },
  hexRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    padding: theme.space(1.5),
    marginBottom: theme.space(1),
  },
  hexContent: {
    flex: 1,
    marginLeft: theme.space(1.5),
  },
  hexTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.ink,
  },
  hexSubtitle: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.inkMuted,
    marginTop: 2,
  },
  viewLink: {
    fontFamily: fonts.bodyBold,
    color: palette.goldDeep,
  },
  noteLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.ink,
    marginBottom: 6,
  },
  noteInput: {
    minHeight: 160,
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    padding: theme.space(1.5),
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.ink,
  },
  wordCount: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.inkMuted,
    marginTop: 6,
    textAlign: "right",
  },
  aiCard: {
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    padding: theme.space(1.5),
    marginTop: theme.space(1.5),
    shadowColor: palette.goldDeep,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  aiQuotaText: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.inkMuted,
    marginTop: theme.space(0.75),
  },
  aiLimitText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: palette.goldDeep,
    marginTop: 4,
  },
  aiCardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.ink,
    marginBottom: 6,
  },
  aiCardText: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.ink,
    lineHeight: 22,
  },
  aiToggle: {
    alignSelf: "flex-end",
    marginTop: theme.space(0.5),
  },
  aiToggleText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: palette.goldDeep,
  },
  aiStatus: {
    marginTop: theme.space(1),
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.inkMuted,
    textAlign: "center",
  },
  aiErrorCard: {
    borderColor: "#F2B8B5",
    backgroundColor: "#FFF5F4",
  },
  aiErrorText: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: "#A43D37",
  },
});

// 📘 Guide screen
function GuideScreen({ navigation }) {
  const [tab, setTab] = useState("Guidance");
  const tabs = ["Guidance", "History", "Glossary"];

  const renderGuidance = () => (
    <SectionCard>
      <Text style={stylesGuide.cardTitle}>Guidance</Text>
      <Text style={stylesGuide.paragraph}>
        <Text style={stylesGuide.bold}>For App Guidance see below.</Text>
      </Text>
      <Text style={stylesGuide.paragraph}>See the <Text style={stylesGuide.bold}>Glossary</Text> for key terms.</Text>
      <Text style={stylesGuide.paragraph}>Visit the <Text style={stylesGuide.bold}>History</Text> tab for a short background on the I Ching.</Text>

      <Text style={stylesGuide.sectionSubtitle}>How It Works</Text>
      <Text style={stylesGuide.paragraph}>
        The system is built on 64 hexagrams, each a figure of six lines (broken for yin, solid for yang).
      </Text>
      <Text style={stylesGuide.paragraph}>Each hexagram represents a pattern, principle, or state of change.</Text>
      <Text style={stylesGuide.paragraph}>
        When you “cast” the I Ching (traditionally with coins or yarrow stalks), you form a primary hexagram describing the present situation.
      </Text>
      <Text style={stylesGuide.paragraph}>
        Some lines may be marked as changing, creating a resulting hexagram that points to where things may be moving.
      </Text>

      <Text style={stylesGuide.sectionSubtitle}>Step by Step</Text>
      <Text style={stylesGuide.paragraph}>
        <Text style={stylesGuide.bold}>Home –</Text> Meditate with a sincere, respectful intention on your question. Enter your question.
      </Text>
      <Text style={stylesGuide.paragraph}>
        <Text style={stylesGuide.bold}>Cast –</Text> Press the Cast button 6 times to reveal your hexagram.
      </Text>
      <Text style={stylesGuide.paragraph}>
        <Text style={stylesGuide.bold}>Reflect –</Text> Read the results and journal your insights.
      </Text>
      <Text style={stylesGuide.paragraph}>
        <Text style={stylesGuide.bold}>Return –</Text> Revisit your Journal to deepen understanding.
      </Text>
    </SectionCard>
  );

  const renderHistory = () => (
    <SectionCard>
      <Text style={stylesGuide.cardTitle}>The I Ching – An Overview</Text>
      <Text style={stylesGuide.paragraph}>
        The I Ching (易經), or Book of Changes, is one of the oldest works of wisdom literature in the world, with roots in ancient China more than 3,000 years ago. It has been studied, consulted, and honored for centuries by philosophers, rulers, and everyday seekers.
      </Text>

      <Text style={stylesGuide.sectionSubtitle}>Core Idea</Text>
      <Text style={stylesGuide.paragraph}>
        The I Ching is not a book of fixed answers, but a guide to understanding change. It reflects the natural cycles of life — growth and decline, stillness and movement, yin and yang. By engaging with it, you invite perspective on your situation and the forces at play.
      </Text>

      <Text style={stylesGuide.sectionSubtitle}>Why Consult It</Text>
      <Text style={stylesGuide.paragraph}>
        The I Ching is not fortune-telling. It offers symbols, images, and reflections that invite you to think differently about your question, decision, or challenge. The wisdom comes from the dialogue you create between your intention and the text.
      </Text>

      <Text style={stylesGuide.sectionSubtitle}>Approach</Text>
      <Text style={stylesGuide.paragraph}>Begin with a sincere and focused intention.</Text>
      <Text style={stylesGuide.paragraph}>
        Read the hexagrams slowly, noticing the imagery and how it resonates with your life.
      </Text>
      <Text style={stylesGuide.paragraph}>
        Reflect rather than rush — the value is in the insights and connections you discover.
      </Text>

      <Text style={stylesGuide.sectionSubtitle}>In Essence</Text>
      <Text style={stylesGuide.paragraph}>
        The I Ching is a mirror of change. Used with respect and openness, it becomes a lifelong companion for clarity, reflection, and guidance.
      </Text>
    </SectionCard>
  );

  const renderGlossary = () => (
    <SectionCard>
      <Text style={stylesGuide.cardTitle}>Glossary</Text>
      {[
        {
          term: "I Ching (Book of Changes)",
          definition:
            "An ancient Chinese text used for divination and self-reflection, composed of hexagrams and commentaries.",
        },
        {
          term: "Hexagram (卦, guà)",
          definition:
            "A six-line figure made up of broken (yin) and unbroken (yang) lines. There are 64 possible hexagrams, each representing a situation, principle, or pattern of change.",
        },
        {
          term: "Yin (陰)",
          definition:
            "A broken line (– –), symbolizing receptivity, yielding, darkness, or the feminine principle.",
        },
        {
          term: "Yang (陽)",
          definition:
            "A solid line (—), symbolizing activity, strength, light, or the masculine principle.",
        },
        {
          term: "Cast",
          definition:
            "The act of consulting the I Ching, traditionally done with yarrow stalks or coins, to generate a hexagram based on chance and intention.",
        },
        {
          term: "Primary Hexagram",
          definition:
            "The initial hexagram you cast, it describes the present situation or main theme of your question.",
        },
        {
          term: "Resulting Hexagram",
          definition:
            "The hexagram formed when changing lines are transformed, offering insight into the direction of change or possible outcome.",
        },
        {
          term: "Changing Lines",
          definition:
            "Lines in a hexagram that shift from yin to yang (or vice versa), producing a second, or “resulting,” hexagram. These highlight the dynamic nature of the situation.",
        },
        {
          term: "Oracle",
          definition:
            "The role the I Ching plays as a source of wisdom — not prediction, but guidance and perspective.",
        },
      ].map((item) => (
        <View key={item.term} style={stylesGuide.glossaryItem}>
          <Text style={stylesGuide.glossaryTerm}>{item.term}</Text>
          <Text style={stylesGuide.paragraph}>{item.definition}</Text>
        </View>
      ))}
    </SectionCard>
  );

  const renderContent = () => {
    if (tab === "History") return renderHistory();
    if (tab === "Glossary") return renderGlossary();
    return renderGuidance();
  };

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: theme.space(2.5),
            paddingBottom: theme.space(3),
            paddingTop: theme.space(2.5) + screenTopPadding,
          }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            style={stylesGuide.backButton}
          >
            <Ionicons name="chevron-back" size={20} color={palette.ink} />
            <Text style={stylesGuide.backLabel}>Back</Text>
          </Pressable>
          <Text style={stylesGuide.sectionTitle}>Guide</Text>
          <View style={stylesGuide.tabRow}>
            {tabs.map((label) => {
              const active = tab === label;
              return (
                <Pressable
                  key={label}
                  onPress={() => setTab(label)}
                  style={[stylesGuide.tabButton, active && stylesGuide.tabButtonActive]}
                >
                  <Text
                    style={[stylesGuide.tabButtonText, active && stylesGuide.tabButtonTextActive]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {renderContent()}
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const stylesGuide = StyleSheet.create({
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: theme.space(1),
    paddingVertical: 6,
    marginBottom: theme.space(1.5),
  },
  backLabel: {
    marginLeft: 6,
    fontFamily: fonts.body,
    color: palette.ink,
    fontSize: 14,
  },
  sectionTitle: {
    fontFamily: fonts.title,
    fontSize: 26,
    color: palette.ink,
    marginBottom: 12,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 4,
    marginBottom: theme.space(2),
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.radius,
    alignItems: "center",
  },
  tabButtonActive: {
    backgroundColor: palette.gold,
  },
  tabButtonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: palette.inkMuted,
  },
  tabButtonTextActive: {
    color: palette.white,
  },
  cardTitle: {
    fontFamily: fonts.title,
    fontSize: 20,
    color: palette.ink,
    marginBottom: theme.space(1),
  },
  sectionSubtitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: palette.ink,
    marginTop: theme.space(2),
    marginBottom: 6,
  },
  paragraph: {
    fontFamily: fonts.body,
    fontSize: 15,
    color: palette.ink,
    lineHeight: 22,
    marginTop: 6,
  },
  glossaryItem: {
    marginTop: theme.space(1.5),
  },
  glossaryTerm: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: palette.ink,
  },
  bold: {
    fontFamily: fonts.bodyBold,
    color: palette.ink,
  },
});

// 💎 Premium screen
function PremiumScreen({ navigation }) {
  const { isPremium: premiumStatus, subscriptionTier } = useAuth();
  const isPremiumMember = Boolean(premiumStatus);
  const currentTier = isPremiumMember ? "premium" : subscriptionTier || "core";

  const featureMatrix = [
    { label: "Complete hexagram library", core: true, premium: true },
    { label: "Automatic casting", core: true, premium: true },
    { label: "Journal & secure storage", core: true, premium: true },
    { label: "AI oracle summaries (100/mo)", core: false, premium: true },
    { label: "Manual casting rituals", core: false, premium: true },
    { label: "Advanced insights & charts", core: false, premium: true },
    { label: "Cloud sync up to 1,000 entries", core: false, premium: true },
  ];

  const handleUpgrade = useCallback(async () => {
    const mailto = "mailto:i.ching.insights64@gmail.com?subject=Upgrade%20to%20AI%20Ching%20Premium";
    try {
      const canOpen = await Linking.canOpenURL(mailto);
      if (!canOpen) {
        throw new Error("No email app available");
      }
      await Linking.openURL(mailto);
    } catch (error) {
      Alert.alert("Unable to open email", error?.message || "Please try again.");
    }
  }, []);

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={stylesPremium.container}>
          <Pressable onPress={() => navigation.goBack()} style={stylesPremium.backButton}>
            <Ionicons name="chevron-back" size={20} color={palette.ink} />
            <Text style={stylesPremium.backLabel}>Back</Text>
          </Pressable>
          <Text style={stylesPremium.title}>Membership</Text>

          <SectionCard style={stylesPremium.pricingCard}>
            <Text style={stylesPremium.sectionTitle}>Choose your path</Text>
            <View style={stylesPremium.tierRow}>
              <View
                style={[
                  stylesPremium.tierCard,
                  currentTier === "core" && !isPremiumMember && stylesPremium.activeTier,
                ]}
              >
                <Text style={stylesPremium.tierLabel}>Core</Text>
                <Text style={stylesPremium.price}>£4.99</Text>
                <Text style={stylesPremium.priceSub}>One-time unlock</Text>
                <Text style={stylesPremium.tierBody}>
                  Essential casting, journaling, and the full 64 hexagram library.
                </Text>
                {currentTier === "core" && !isPremiumMember ? (
                  <View style={stylesPremium.badge}>
                    <Text style={stylesPremium.badgeText}>Current plan</Text>
                  </View>
                ) : null}
              </View>
              <View
                style={[
                  stylesPremium.tierCard,
                  stylesPremium.premiumTier,
                  isPremiumMember && stylesPremium.activeTier,
                ]}
              >
                <Text style={stylesPremium.tierLabel}>Premium</Text>
                <Text style={stylesPremium.price}>£2.99</Text>
                <Text style={stylesPremium.priceSub}>Per month</Text>
                <Text style={stylesPremium.tierBody}>
                  Unlock AI summaries, manual casting, cloud backup, and rich analytics.
                </Text>
                {isPremiumMember ? (
                  <View style={stylesPremium.badge}>
                    <Text style={stylesPremium.badgeText}>Active</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={stylesPremium.matrixHeader}>
              <Text style={stylesPremium.matrixTitleLeft}>Feature</Text>
              <Text style={stylesPremium.matrixTitle}>Core</Text>
              <Text style={stylesPremium.matrixTitle}>Premium</Text>
            </View>
            {featureMatrix.map((row) => (
              <View key={row.label} style={stylesPremium.matrixRow}>
                <Text style={stylesPremium.featureLabel}>{row.label}</Text>
                <View style={stylesPremium.matrixIconCell}>
                  <Ionicons
                    name={row.core ? "checkmark-circle" : "close-circle"}
                    size={18}
                    color={row.core ? palette.goldDeep : palette.inkMuted}
                  />
                </View>
                <View style={stylesPremium.matrixIconCell}>
                  <Ionicons
                    name={row.premium ? "checkmark-circle" : "close-circle"}
                    size={18}
                    color={row.premium ? palette.goldDeep : palette.inkMuted}
                  />
                </View>
              </View>
            ))}

            {isPremiumMember ? (
              <View style={stylesPremium.noticeCard}>
                <Ionicons name="sparkles" size={18} color={palette.goldDeep} />
                <Text style={stylesPremium.noticeText}>
                  Thank you for supporting AI Ching Insights. Enjoy every premium feature.
                </Text>
              </View>
            ) : (
              <GoldButton
                full
                onPress={handleUpgrade}
                icon={<Ionicons name="sparkles-outline" size={18} color={palette.white} />}
              >
                Upgrade to Premium (£2.99/month)
              </GoldButton>
            )}
          </SectionCard>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const stylesPremium = StyleSheet.create({
  container: {
    padding: theme.space(2.5),
    paddingBottom: theme.space(4),
    paddingTop: theme.space(2.5) + screenTopPadding,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: theme.space(1),
    paddingVertical: 6,
    marginBottom: theme.space(1.5),
  },
  backLabel: {
    marginLeft: 6,
    fontFamily: fonts.body,
    color: palette.ink,
    fontSize: 14,
  },
  title: {
    fontFamily: fonts.title,
    fontSize: 26,
    color: palette.ink,
    marginBottom: theme.space(2),
  },
  sectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: palette.ink,
    marginBottom: theme.space(1.5),
  },
  pricingCard: {
    backgroundColor: palette.white,
  },
  tierRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: theme.space(2),
    gap: theme.space(1.5),
    flexWrap: "wrap",
  },
  tierCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: "#FAF7ED",
    borderRadius: theme.radius,
    padding: theme.space(1.75),
    borderWidth: 1,
    borderColor: palette.border,
    position: "relative",
  },
  premiumTier: {
    backgroundColor: "#FDF4DC",
    borderColor: palette.gold,
  },
  activeTier: {
    shadowColor: palette.goldDeep,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  tierLabel: {
    fontFamily: fonts.title,
    fontSize: 20,
    color: palette.ink,
    marginBottom: 4,
  },
  price: {
    fontFamily: fonts.title,
    fontSize: 24,
    color: palette.goldDeep,
  },
  priceSub: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: palette.inkMuted,
    marginBottom: theme.space(1),
  },
  tierBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.ink,
    lineHeight: 20,
  },
  badge: {
    position: "absolute",
    top: theme.space(1),
    right: theme.space(1),
    backgroundColor: palette.gold,
    borderRadius: 999,
    paddingHorizontal: theme.space(1),
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: palette.white,
  },
  matrixHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  matrixTitle: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: palette.ink,
    textAlign: "center",
  },
  matrixTitleLeft: {
    flex: 2,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: palette.ink,
    textAlign: "left",
  },
  matrixRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  matrixIconCell: {
    flex: 1,
    alignItems: "center",
  },
  featureLabel: {
    flex: 2,
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.ink,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FDF4DC",
    borderRadius: theme.radius,
    padding: theme.space(1.25),
    marginTop: theme.space(2),
    gap: theme.space(1),
  },
  noticeText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.ink,
  },
});

// ⚙️ Settings screen
function SettingsScreen({ navigation }) {
  const [feedback, setFeedback] = useState("");

  const handleOpenPremium = useCallback(() => {
    navigation.navigate("Premium");
  }, [navigation]);

  const handleRateApp = useCallback(async () => {
    const iosStore = "https://apps.apple.com/app/id000000000";
    const androidStore = "https://play.google.com/store/apps/details?id=com.example";
    const target = Platform.select({ ios: iosStore, android: androidStore, default: iosStore });
    try {
      if (target) {
        await Linking.openURL(target);
      }
    } catch (error) {
      Alert.alert("Unable to open store", error?.message || "Please try again.");
    }
  }, []);

  const handleShareApp = useCallback(async () => {
    try {
      await Share.share({
        message: "Explore AI Ching Insights for reflective guidance and journaling. Download now!",
      });
    } catch (error) {
      Alert.alert("Share failed", error?.message || "Please try again.");
    }
  }, []);

  const handleOpenLink = useCallback(async (url) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert("Unable to open link", error?.message || "Please try again.");
    }
  }, []);

  const handleSubmitFeedback = useCallback(async () => {
    const trimmed = feedback.trim();
    if (!trimmed) {
      Alert.alert("Feedback", "Please share a few words before submitting.");
      return;
    }
    const subject = encodeURIComponent("AI Ching Insights Feedback");
    const body = encodeURIComponent(trimmed);
    const mailto = `mailto:i.ching.insights64@gmail.com?subject=${subject}&body=${body}`;
    try {
      const canOpen = await Linking.canOpenURL(mailto);
      if (!canOpen) {
        throw new Error("No email app available");
      }
      await Linking.openURL(mailto);
      setFeedback("");
    } catch (error) {
      Alert.alert("Unable to send email", error?.message || "Please try again.");
    }
  }, [feedback]);

  return (
    <GradientBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={stylesSettings.container}>
          <Pressable onPress={() => navigation.goBack()} style={stylesSettings.backButton}>
            <Ionicons name="chevron-back" size={20} color={palette.ink} />
            <Text style={stylesSettings.backLabel}>Back</Text>
          </Pressable>
          <Text style={stylesSettings.title}>Settings</Text>

          <SectionCard>
            <Pressable onPress={handleOpenPremium} style={stylesSettings.row}>
              <Text style={stylesSettings.rowLabel}>Premium</Text>
              <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
            </Pressable>
            <View style={stylesSettings.rowDivider} />
            <Pressable onPress={handleRateApp} style={stylesSettings.row}>
              <Text style={stylesSettings.rowLabel}>Rate app</Text>
              <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
            </Pressable>
            <View style={stylesSettings.rowDivider} />
            <Pressable onPress={handleShareApp} style={stylesSettings.row}>
              <Text style={stylesSettings.rowLabel}>Share app</Text>
              <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
            </Pressable>
            <View style={stylesSettings.rowDivider} />
            <Pressable
              onPress={() => handleOpenLink("https://aichinginsights.com/privacy")}
              style={stylesSettings.row}
            >
              <Text style={stylesSettings.rowLabel}>Privacy Policy</Text>
              <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
            </Pressable>
            <View style={stylesSettings.rowDivider} />
            <Pressable
              onPress={() => handleOpenLink("https://aichinginsights.com/terms")}
              style={stylesSettings.row}
            >
              <Text style={stylesSettings.rowLabel}>Terms and Conditions</Text>
              <Ionicons name="chevron-forward" size={18} color={palette.inkMuted} />
            </Pressable>
          </SectionCard>

          <SectionCard>
            <Text style={stylesSettings.feedbackTitle}>Feedback</Text>
            <Text style={stylesSettings.feedbackHint}>
              Share your reflections or suggestions. Your email app will open when you submit.
            </Text>
            <TextInput
              value={feedback}
              onChangeText={setFeedback}
              placeholder="Type your feedback here"
              placeholderTextColor={palette.inkMuted}
              multiline
              style={stylesSettings.feedbackInput}
            />
            <GoldButton
              full
              onPress={handleSubmitFeedback}
              icon={<Ionicons name="send-outline" size={18} color={palette.white} />}
            >
              Send Feedback
            </GoldButton>
          </SectionCard>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const stylesSettings = StyleSheet.create({
  container: {
    padding: theme.space(2.5),
    paddingBottom: theme.space(4),
    paddingTop: theme.space(2.5) + screenTopPadding,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: palette.white,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: theme.space(1),
    paddingVertical: 6,
    marginBottom: theme.space(1.5),
  },
  backLabel: {
    marginLeft: 6,
    fontFamily: fonts.body,
    color: palette.ink,
    fontSize: 14,
  },
  title: {
    fontFamily: fonts.title,
    fontSize: 26,
    color: palette.ink,
    marginBottom: theme.space(2),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  rowLabel: {
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.ink,
  },
  rowDivider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: 4,
  },
  feedbackTitle: {
    fontFamily: fonts.title,
    fontSize: 18,
    color: palette.ink,
    marginBottom: 6,
  },
  feedbackHint: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: palette.inkMuted,
    marginBottom: theme.space(1),
  },
  feedbackInput: {
    minHeight: 120,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.white,
    padding: theme.space(1.5),
    fontFamily: fonts.body,
    fontSize: 16,
    color: palette.ink,
    marginBottom: theme.space(1.5),
    textAlignVertical: "top",
  },
});

// 🧭 Navigation
const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: "transparent" },
};

function AuthStackScreen() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeRoot" component={HomeScreen} />
      <Stack.Screen name="Cast" component={CastScreen} />
      <Stack.Screen name="ManualCasting" component={ManualCastingScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
      <Stack.Screen name="Guide" component={GuideScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Premium" component={PremiumScreen} />
    </Stack.Navigator>
  );
}

function JournalStackScreen() {
  return (
    <JournalStack.Navigator screenOptions={{ headerShown: false }}>
      <JournalStack.Screen name="JournalList" component={JournalListScreen} />
      <JournalStack.Screen name="JournalDetail" component={JournalDetailScreen} />
    </JournalStack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: palette.gold,
        tabBarInactiveTintColor: palette.inkMuted,
        tabBarStyle: {
          backgroundColor: palette.card,
          borderTopColor: "rgba(176, 139, 49, 0.35)",
          borderTopWidth: 1,
          shadowColor: palette.goldDeep,
          shadowOpacity: 0.16,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: -4 },
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bodyBold,
          fontSize: 12,
        },
        tabBarItemStyle: {
          paddingVertical: 6,
        },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home: "home-outline",
            Library: "bookmarks-outline",
            Journal: "create-outline",
            Insights: "stats-chart-outline",
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Journal" component={JournalStackScreen} />
      <Tab.Screen name="Library" component={LibraryScreen} />
      <Tab.Screen name="Insights" component={InsightsOverviewScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [marcellusLoaded] = useMarcellus({ Marcellus_400Regular });
  const [loraLoaded] = useLora({ Lora_400Regular, Lora_600SemiBold });
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const fetchProfile = useCallback(async () => {
    const userId = session?.user?.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from("Profiles")
        .select("display_name,email,is_premium,subscription_tier")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        console.log("Profile fetch error:", error.message);
      }
      setProfile(data ?? null);
    } catch (error) {
      console.log("Profile fetch error:", error?.message || error);
      setProfile(null);
    } finally {
      setLoadingProfile(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    let isMounted = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data?.session ?? null);
        setAuthReady(true);
      })
      .catch((error) => {
        console.log("Session fetch error:", error?.message || error);
        if (isMounted) {
          setAuthReady(true);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthReady(true);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady) return;
    fetchProfile();
  }, [authReady, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const premiumStatus = useMemo(
    () => profile?.subscription_tier === "premium" || profile?.is_premium,
    [profile?.is_premium, profile?.subscription_tier]
  );

  const authValue = useMemo(
    () => ({
      session,
      profile,
      loadingProfile,
      refreshProfile: fetchProfile,
      signOut,
      authReady,
      isPremium: premiumStatus,
      subscriptionTier: profile?.subscription_tier ?? null,
    }),
    [
      session,
      profile,
      loadingProfile,
      fetchProfile,
      signOut,
      authReady,
      premiumStatus,
    ]
  );

  if (!marcellusLoaded || !loraLoaded || !authReady) return null;

  return (
    <AuthContext.Provider value={authValue}>
      <JournalProvider>
        <NavigationContainer theme={navTheme}>
          {session ? <MainTabs /> : <AuthStackScreen />}
        </NavigationContainer>
      </JournalProvider>
    </AuthContext.Provider>
  );
}
