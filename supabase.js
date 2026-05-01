window.SUPABASE_CONFIG = window.SUPABASE_CONFIG || {
  url: 'https://xjezeixzbeftnmqbvchc.supabase.co',
  anonKey: 'sb_publishable_upzsNtgCx1Pa74qVaMg1MA_A_ftpKx4'
};

(function initPbxSupabaseApi() {
  const COURSE_ORDER = ["1-kurs", "2-kurs", "3-kurs", "4-kurs", "5-kurs", "Umumiy call"];
  const LMS_STUDY_FORM_ORDER = ["Kunduzgi", "Sirtqi", "Masofaviy"];
  const LMS_SECTION_ORDER = [
    "talabalar",
    "chetlashtirilganlar",
    "akademik_tatil",
    "akademik_mobillik",
    "bitirganlar",
    "bekor_qilinganlar"
  ];
  const LMS_SECTION_LABELS = {
    talabalar: "Talabalar",
    chetlashtirilganlar: "Chetlashtirilganlar",
    akademik_tatil: "Akademik ta'til",
    akademik_mobillik: "Akademik mobillik",
    bitirganlar: "Bitirganlar",
    bekor_qilinganlar: "Bekor qilinganlar"
  };
  const TASK_DEPARTMENT_MAP = {
    "9035378": "Copywriter",
    "8952902": "2-kurs",
    "8952890": "3-kurs",
    "8952522": "1-kurs",
    "8952886": "4-kurs",
    "8952862": "5-kurs",
    "8991158": "Umumiy call",
    "9035354": "Talabalar bo'limi"
  };

  function assertSupabaseReady() {
    if (!window.supabase || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey) {
      throw new Error("Supabase sozlanmagan. `supabase.js` ichida `url` va `anonKey` ni to'ldiring.");
    }
  }

  function getClient() {
    assertSupabaseReady();

    if (!window.__pbxSupabaseClient) {
      window.__pbxSupabaseClient = window.supabase.createClient(
        window.SUPABASE_CONFIG.url,
        window.SUPABASE_CONFIG.anonKey
      );
    }

    return window.__pbxSupabaseClient;
  }

  let dashboardRealtimeChannel = null;

  function getTashkentToday() {
    const date = new Date(Date.now() + 5 * 60 * 60 * 1000);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }

  function shiftDate(isoDate, dayOffset) {
    const [year, month, day] = isoDate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + dayOffset);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }

  function resolveRange(options) {
    const preset = options?.preset || "today";
    const today = getTashkentToday();

    if (preset === "range") {
      return {
        preset,
        startDate: options?.start || today,
        endDate: options?.end || options?.start || today
      };
    }

    if (preset === "month") {
      return {
        preset,
        startDate: shiftDate(today, -29),
        endDate: today
      };
    }

    if (preset === "week") {
      return {
        preset,
        startDate: shiftDate(today, -6),
        endDate: today
      };
    }

    return {
      preset: "today",
      startDate: today,
      endDate: today
    };
  }

  function getRangeDayCount(startDate, endDate) {
    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
    const start = Date.UTC(startYear, startMonth - 1, startDay);
    const end = Date.UTC(endYear, endMonth - 1, endDay);
    return Math.max(1, Math.floor((end - start) / 86400000) + 1);
  }

  function resolvePreviousRange(filter) {
    const dayCount = getRangeDayCount(filter.startDate, filter.endDate);
    return {
      startDate: shiftDate(filter.startDate, -dayCount),
      endDate: shiftDate(filter.endDate, -dayCount)
    };
  }

  function formatDuration(totalSeconds) {
    const seconds = Number(totalSeconds || 0);
    const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${mins}:${secs}`;
  }

  function formatTaskDate(isoValue) {
    if (!isoValue) return "-";

    const date = new Date(isoValue);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Tashkent",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function toTashkentDateString(isoValue) {
    if (!isoValue) return "";

    const date = new Date(isoValue);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tashkent",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);

    const year = parts.find(item => item.type === "year")?.value;
    const month = parts.find(item => item.type === "month")?.value;
    const day = parts.find(item => item.type === "day")?.value;
    return `${year}-${month}-${day}`;
  }

  async function callRpc(name, params) {
    const client = getClient();
    const { data, error } = await client.rpc(name, params);
    if (error) {
      throw error;
    }
    return data;
  }

  async function callRpcOptional(name, params, fallbackValue) {
    try {
      return await callRpc(name, params);
    } catch (error) {
      console.warn(`Optional RPC failed: ${name}`, error);
      return fallbackValue;
    }
  }

  async function loadDashboardData(options) {
    const filter = resolveRange(options);
    const previousFilter = resolvePreviousRange(filter);
    const weeklyFilter = {
      startDate: shiftDate(filter.endDate, -6),
      endDate: filter.endDate
    };

    const client = getClient();
    const [summaryRows, previousSummaryRows, dailySeries, hourlySeries, extensionSeries, previousExtensionSeries, recentCalls, courseBreakdownRows, courseQualityBreakdownRows, tasksResult] = await Promise.all([
      callRpc("get_pbx_summary", {
        p_start_date: filter.startDate,
        p_end_date: filter.endDate
      }),
      callRpc("get_pbx_summary", {
        p_start_date: previousFilter.startDate,
        p_end_date: previousFilter.endDate
      }),
      callRpc("get_pbx_daily_series", {
        p_start_date: weeklyFilter.startDate,
        p_end_date: weeklyFilter.endDate
      }),
      callRpc("get_pbx_hourly_series", {
        p_start_date: filter.startDate,
        p_end_date: filter.endDate
      }),
      callRpc("get_pbx_extension_series", {
        p_start_date: filter.startDate,
        p_end_date: filter.endDate
      }),
      callRpc("get_pbx_extension_series", {
        p_start_date: previousFilter.startDate,
        p_end_date: previousFilter.endDate
      }),
      callRpc("get_pbx_recent_calls", {
        p_start_date: filter.startDate,
        p_end_date: filter.endDate,
        p_limit: 20
      }),
      callRpc("get_pbx_course_breakdown", {
        p_start_date: filter.startDate,
        p_end_date: filter.endDate
      }),
      callRpcOptional("get_pbx_course_quality_breakdown", {
        p_start_date: filter.startDate,
        p_end_date: filter.endDate
      }, []),
      client
        .from("crm_tasks")
        .select("id, responsible_user_id, entity_id, entity_type, text, is_completed, complete_till, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(100)
    ]);

    const summary = Array.isArray(summaryRows) && summaryRows.length ? summaryRows[0] : {};
    const previousSummary = Array.isArray(previousSummaryRows) && previousSummaryRows.length ? previousSummaryRows[0] : {};
    const extensions = normalizeCourseSeries(extensionSeries);
    const courseBreakdown = Array.isArray(courseBreakdownRows) && courseBreakdownRows.length
      ? normalizeCourseBreakdown(courseBreakdownRows)
      : buildCourseBreakdownFromTotals(extensions);
    const tasks = normalizeTasks(tasksResult.data, filter);
    const taskDepartments = buildTaskDepartments(tasks);
    const totalCalls = Number(summary.total_calls || 0);
    const previousTotalCalls = Number(previousSummary.total_calls || 0);

    const answeredCalls = Number(summary.answered_calls || 0);
    const previousAnsweredCalls = Number(previousSummary.answered_calls || 0);
    const inboundCalls = Number(summary.inbound_calls || 0);
    const previousInboundCalls = Number(previousSummary.inbound_calls || 0);
    const outboundCalls = Number(summary.outbound_calls || 0);
    const previousOutboundCalls = Number(previousSummary.outbound_calls || 0);
    const uniqueContacts = Number(summary.unique_contacts || 0);
    const previousUniqueContacts = Number(previousSummary.unique_contacts || 0);
    const avgTalkSeconds = Number(summary.avg_talk_seconds || 0);
    const previousAvgTalkSeconds = Number(previousSummary.avg_talk_seconds || 0);
    const offHoursCalls = findExtensionCallCount(extensionSeries, "5002");
    const previousOffHoursCalls = findExtensionCallCount(previousExtensionSeries, "5002");
    const missedCalls = Math.max(totalCalls - answeredCalls, 0);
    const previousMissedCalls = Math.max(previousTotalCalls - previousAnsweredCalls, 0);
    const workedRate = totalCalls ? Math.round((answeredCalls / totalCalls) * 100) : 0;
    const previousWorkedRate = previousTotalCalls ? Math.round((previousAnsweredCalls / previousTotalCalls) * 100) : 0;

    return {
      source: "supabase",
      message: `Supabase live data: ${filter.startDate} - ${filter.endDate}`,
      filter,
      totalCalls,
      totalTrend: buildTrend(totalCalls, previousTotalCalls, filter.preset),
      inboundCalls,
      inboundTrend: buildTrend(inboundCalls, previousInboundCalls, filter.preset),
      outboundCalls,
      outboundTrend: buildTrend(outboundCalls, previousOutboundCalls, filter.preset),
      missedCalls,
      missedTrend: buildTrend(missedCalls, previousMissedCalls, filter.preset),
      answeredCalls,
      answeredTrend: buildTrend(answeredCalls, previousAnsweredCalls, filter.preset),
      offHoursCalls,
      offHoursCallsTrend: buildTrend(offHoursCalls, previousOffHoursCalls, filter.preset),
      workedRate,
      workedRateTrend: buildTrend(workedRate, previousWorkedRate, filter.preset),
      avgCallTime: formatDuration(avgTalkSeconds),
      avgCallTimeTrend: buildTrend(avgTalkSeconds, previousAvgTalkSeconds, filter.preset),
      uniqueContacts,
      uniqueContactsTrend: buildTrend(uniqueContacts, previousUniqueContacts, filter.preset),
      taskSummary: buildTaskSummary(tasks),
      taskDepartments,
      tasks,
      recentCalls: (Array.isArray(recentCalls) ? recentCalls : []).map(item => ({
        client: item.client || "Noma'lum",
        manager: item.department || "-",
        time: item.call_time || "-",
        status: item.status || "Qo'ng'iroq",
        duration: formatDuration(item.duration_sec || 0)
      })),
      managers: courseBreakdown.map(item => ({
        name: item.extension_label,
        deals: Number(item.answered || 0),
        answered: Number(item.answered || 0),
        total: Number(item.total_calls || 0),
        revenue: `${Number(item.total_calls || 0)} ta jami qo'ng'iroq`
      })),
      dailySeries: Array.isArray(dailySeries) && dailySeries.length
        ? buildContinuousDailySeries(weeklyFilter.startDate, weeklyFilter.endDate, dailySeries)
        : buildContinuousDailySeries(weeklyFilter.startDate, weeklyFilter.endDate, []),
      hourlySeries: Array.isArray(hourlySeries) && hourlySeries.length
        ? hourlySeries.map(item => ({ label: item.hour_label, value: Number(item.total_calls || 0) }))
        : [{ label: "00:00", value: 0 }],
      extensionSeries: extensions.length
        ? extensions.map(item => ({ label: item.extension_label, value: Number(item.total_calls || 0) }))
        : [{ label: "Ma'lumot yo'q", value: 0 }],
      courseBreakdown,
      courseQualityBreakdown: normalizeCourseQualityBreakdown(courseQualityBreakdownRows)
    };
  }

  function buildOrderedCountList(rows, field, order, labelMap) {
    const counter = new Map();

    (Array.isArray(rows) ? rows : []).forEach(item => {
      const key = String(item?.[field] || "").trim();
      if (!key) return;
      counter.set(key, (counter.get(key) || 0) + 1);
    });

    const ordered = order
      .filter(key => counter.has(key))
      .map(key => ({
        key,
        label: labelMap?.[key] || key,
        value: counter.get(key) || 0
      }));

    const extra = Array.from(counter.entries())
      .filter(([key]) => !order.includes(key))
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({
        key,
        label: labelMap?.[key] || key,
        value
      }));

    return [...ordered, ...extra];
  }

  function sumSummaryField(rows, field) {
    return (Array.isArray(rows) ? rows : []).reduce((total, item) => total + Number(item?.[field] || 0), 0);
  }

  function buildSummaryBreakdown(rows, order, fieldName, valueField) {
    return order.map(label => ({
      key: label,
      label,
      value: (Array.isArray(rows) ? rows : [])
        .filter(item => String(item?.[fieldName] || "").trim() === label)
        .reduce((total, item) => total + Number(item?.[valueField] || 0), 0)
    }));
  }

  function pickSummaryDate(rows, fieldName, pickLatest = false) {
    const values = (Array.isArray(rows) ? rows : [])
      .map(item => String(item?.[fieldName] || "").trim())
      .filter(Boolean)
      .sort();

    if (!values.length) {
      return null;
    }

    return pickLatest ? values[values.length - 1] : values[0];
  }

  async function loadLmsData() {
    const client = getClient();
    const [studentsResult, paymentsResult, syncLogsResult] = await Promise.all([
      client
        .from("lms_students_summary")
        .select("campus, study_form_context, aktiv_talabalar, chetlashtirilganlar, akademik_tatil, akademik_mobillik, bitirganlar, bekor_qilinganlar, jami"),
      client
        .from("lms_payments_summary")
        .select("campus, study_form_context, tolovlar_soni, jami_tolov_summa, eng_eski_tolov, eng_yangi_tolov"),
      client
        .from("lms_sync_logs")
        .select("created_at")
        .eq("type", "sync-lms")
        .order("created_at", { ascending: false })
        .limit(1)
    ]);

    if (studentsResult.error) {
      throw studentsResult.error;
    }

    if (paymentsResult.error) {
      throw paymentsResult.error;
    }

    if (syncLogsResult.error) {
      throw syncLogsResult.error;
    }

    const students = Array.isArray(studentsResult.data) ? studentsResult.data : [];
    const payments = Array.isArray(paymentsResult.data) ? paymentsResult.data : [];
    const latestSyncAt = syncLogsResult.data?.[0]?.created_at || null;

    return {
      source: "supabase",
      message: "LMS summary data",
      studentsSummary: students,
      paymentsSummary: payments,
      studentsTotal: sumSummaryField(students, "jami"),
      paymentsTotal: sumSummaryField(payments, "tolovlar_soni"),
      paymentsAmountTotal: sumSummaryField(payments, "jami_tolov_summa"),
      latestSyncAt,
      oldestPaymentDate: pickSummaryDate(payments, "eng_eski_tolov", false),
      newestPaymentDate: pickSummaryDate(payments, "eng_yangi_tolov", true),
      studentBreakdown: {
        byStudyForm: buildSummaryBreakdown(students, LMS_STUDY_FORM_ORDER, "study_form_context", "jami"),
        bySection: [
          { key: "talabalar", label: LMS_SECTION_LABELS.talabalar, value: sumSummaryField(students, "aktiv_talabalar") },
          { key: "chetlashtirilganlar", label: LMS_SECTION_LABELS.chetlashtirilganlar, value: sumSummaryField(students, "chetlashtirilganlar") },
          { key: "akademik_tatil", label: LMS_SECTION_LABELS.akademik_tatil, value: sumSummaryField(students, "akademik_tatil") },
          { key: "akademik_mobillik", label: LMS_SECTION_LABELS.akademik_mobillik, value: sumSummaryField(students, "akademik_mobillik") },
          { key: "bitirganlar", label: LMS_SECTION_LABELS.bitirganlar, value: sumSummaryField(students, "bitirganlar") },
          { key: "bekor_qilinganlar", label: LMS_SECTION_LABELS.bekor_qilinganlar, value: sumSummaryField(students, "bekor_qilinganlar") }
        ],
        byCampus: buildSummaryBreakdown(students, ["Toshkent", "Samarqand"], "campus", "jami")
      },
      paymentBreakdown: {
        byStudyForm: buildSummaryBreakdown(payments, LMS_STUDY_FORM_ORDER, "study_form_context", "tolovlar_soni"),
        byCampus: buildSummaryBreakdown(payments, ["Toshkent", "Samarqand"], "campus", "tolovlar_soni")
      }
    };
  }

  function normalizeCourseSeries(extensionSeries) {
    const normalizedMap = new Map(COURSE_ORDER.map(label => [label, 0]));
    const rows = Array.isArray(extensionSeries) ? extensionSeries : [];

    rows.forEach(item => {
      const label = String(item.extension_label || "").trim();
      if (!normalizedMap.has(label)) {
        return;
      }

      normalizedMap.set(label, normalizedMap.get(label) + Number(item.total_calls || 0));
    });

    return COURSE_ORDER.map(label => ({
      extension_label: label,
      total_calls: normalizedMap.get(label) || 0
    }));
  }

  function buildContinuousDailySeries(startDate, endDate, rows) {
    const valueMap = new Map(
      (Array.isArray(rows) ? rows : []).map(item => [String(item.day_label || ""), Number(item.total_calls || 0)])
    );
    const result = [];
    let cursor = startDate;

    while (cursor <= endDate) {
      const [year, month, day] = cursor.split("-").map(Number);
      const label = `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}`;
      result.push({
        label,
        value: valueMap.get(label) || 0
      });
      cursor = shiftDate(cursor, 1);
    }

    return result;
  }

  function findExtensionCallCount(extensionSeries, extensionLabel) {
    const item = (Array.isArray(extensionSeries) ? extensionSeries : []).find(
      row => String(row.extension_label || "").trim() === String(extensionLabel)
    );
    return Number(item?.total_calls || 0);
  }

  function normalizeCourseBreakdown(rows) {
    const normalizedMap = new Map(
      COURSE_ORDER.map(label => [
        label,
        {
          extension_label: label,
          inbound: 0,
          outbound: 0,
          answered: 0,
          missed: 0,
          total_calls: 0
        }
      ])
    );

    (Array.isArray(rows) ? rows : []).forEach(item => {
      const label = String(item.extension_label || "").trim();
      if (!normalizedMap.has(label)) {
        return;
      }

      normalizedMap.set(label, {
        extension_label: label,
        inbound: Number(item.inbound || 0),
        outbound: Number(item.outbound || 0),
        answered: Number(item.answered || 0),
        missed: Math.max(Number(item.total_calls || 0) - Number(item.answered || 0), 0),
        total_calls: Number(item.total_calls || 0)
      });
    });

    return COURSE_ORDER.map(label => normalizedMap.get(label));
  }

  function normalizeCourseQualityBreakdown(rows) {
    const courseLabels = COURSE_ORDER.filter(label => label !== "Umumiy call");
    const rowMap = new Map(
      courseLabels.map(label => [
        label,
        { label, grades: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }
      ])
    );

    (Array.isArray(rows) ? rows : []).forEach(item => {
      const label = String(item.extension_label || "").trim();
      const grade = Number(item.grade_value || 0);
      if (!rowMap.has(label) || grade < 1 || grade > 5) {
        return;
      }

      rowMap.get(label).grades[grade] = Number(item.grade_count || 0);
    });

    return courseLabels.map(label => rowMap.get(label));
  }

  function buildCourseBreakdownFromTotals(extensions) {
    return COURSE_ORDER.map(label => {
      const item = (Array.isArray(extensions) ? extensions : []).find(entry => entry.extension_label === label);
      const totalCalls = Number(item?.total_calls || 0);

      return {
        extension_label: label,
        inbound: totalCalls,
        outbound: 0,
        answered: 0,
        missed: totalCalls,
        total_calls: totalCalls
      };
    });
  }

  function buildTrend(currentValue, previousValue, preset) {
    if (!previousValue && !currentValue) {
      return { value: 0, label: "Kechagiga nisbatan", direction: "flat" };
    }

    if (!previousValue && currentValue) {
      return {
        value: 100,
        label: preset === "today" ? "Kechagiga nisbatan" : "Oldingi davrga nisbatan",
        direction: "up"
      };
    }

    const change = Math.round(((currentValue - previousValue) / previousValue) * 100);

    return {
      value: change,
      label: preset === "today" ? "Kechagiga nisbatan" : "Oldingi davrga nisbatan",
      direction: change > 0 ? "up" : change < 0 ? "down" : "flat"
    };
  }

  function normalizeTasks(rows, filter) {
    const today = getTashkentToday();

    return (Array.isArray(rows) ? rows : [])
      .map(item => {
        const taskDate = toTashkentDateString(item.complete_till || item.created_at || item.updated_at);
        const responsibleUserId = item.responsible_user_id ?? "-";
        return {
          id: item.id,
          text: item.text || "Task",
          entityId: item.entity_id ?? "-",
          entityType: item.entity_type || "-",
          responsibleUserId,
          departmentName: TASK_DEPARTMENT_MAP[String(responsibleUserId)] || String(responsibleUserId),
          isCompleted: Boolean(item.is_completed),
          completeTill: formatTaskDate(item.complete_till || item.created_at || item.updated_at),
          taskDate,
          isOverdue: !item.is_completed && taskDate && taskDate < today
        };
      })
      .filter(item => item.taskDate >= filter.startDate && item.taskDate <= filter.endDate);
  }

  function buildTaskSummary(tasks) {
    const rows = Array.isArray(tasks) ? tasks : [];
    const openRows = rows.filter(item => !item.isCompleted);
    return {
      total: openRows.length,
      open: openRows.length,
      completed: rows.filter(item => item.isCompleted).length,
      overdue: openRows.filter(item => item.isOverdue).length
    };
  }

  function buildTaskDepartments(tasks) {
    const openRows = (Array.isArray(tasks) ? tasks : []).filter(item => !item.isCompleted);
    const departmentMap = new Map();

    openRows.forEach(item => {
      const key = String(item.responsibleUserId);
      if (!departmentMap.has(key)) {
        departmentMap.set(key, {
          responsibleUserId: key,
          name: item.departmentName,
          total: 0,
          overdue: 0
        });
      }

      const department = departmentMap.get(key);
      department.total += 1;
      if (item.isOverdue) {
        department.overdue += 1;
      }
    });

    return Array.from(departmentMap.values()).sort((a, b) => b.total - a.total);
  }

  window.pbxSupabaseApi = {
    getTashkentToday,
    resolveRange,
    loadDashboardData,
    loadLmsData,
    subscribeToDashboardChanges(onChange) {
      const client = getClient();

      if (dashboardRealtimeChannel) {
        client.removeChannel(dashboardRealtimeChannel);
        dashboardRealtimeChannel = null;
      }

      dashboardRealtimeChannel = client
        .channel("pbx-dashboard-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "pbx_calls" },
          () => onChange?.({ table: "pbx_calls" })
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "crm_tasks" },
          () => onChange?.({ table: "crm_tasks" })
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "lms_students" },
          () => onChange?.({ table: "lms_students" })
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "lms_payments" },
          () => onChange?.({ table: "lms_payments" })
        )
        .subscribe();

      return () => {
        if (dashboardRealtimeChannel) {
          client.removeChannel(dashboardRealtimeChannel);
          dashboardRealtimeChannel = null;
        }
      };
    }
  };
})();
