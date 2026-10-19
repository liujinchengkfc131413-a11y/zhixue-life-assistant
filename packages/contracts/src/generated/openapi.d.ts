export interface paths {
    "/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 进程存活检查 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 服务进程存活 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            status?: string;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 应用内通知列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["NotificationsEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/{id}:read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 标记通知已读 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 已标记 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MutationEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/chats/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** 重命名 AI 会话 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        title: string;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 更新后的会话 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChatSessionEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/tasks/{id}/dependencies": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 查看任务依赖 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 任务的前置与后继依赖 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                taskId: string;
                                predecessorTaskIds: string[];
                                successorTaskIds: string[];
                            };
                            meta: {
                                requestId: string;
                            };
                        };
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        /** 添加任务依赖 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        predecessorTaskId: string;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 依赖已添加 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        /** 解除任务前置依赖 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        predecessorTaskId: string;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 依赖已解除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/entities/{id}/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 查看核心对象标签 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 对象当前标签 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                id: string;
                                name: string;
                                colorToken: string | null;
                                description: string | null;
                                version: number;
                            }[];
                            meta: {
                                requestId: string;
                            };
                        };
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        /** 关联核心对象标签 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        tagId: string;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 标签已关联 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        /** 移除核心对象标签 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        tagId: string;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 标签已移除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications:read-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 全部标记已读 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 已全部标记 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MutationEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/{id}:snooze": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 稍后提醒 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: date-time */
                        snoozedUntil: string;
                    };
                };
            };
            responses: {
                /** @description 已设置稍后提醒 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MutationEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/reminders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 列出提醒定义 */
        get: {
            parameters: {
                query?: {
                    targetEntityId?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 提醒定义列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RemindersEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        /** 创建提醒定义 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        targetEntityId: string;
                        /** @enum {string} */
                        triggerMode: "ABSOLUTE" | "OFFSET_BEFORE_START" | "OFFSET_BEFORE_DUE";
                        /** Format: date-time */
                        triggerAt?: string | null;
                        offsetMinutes?: number | null;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ReminderEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/events/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 读取日程详情 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 日程详情 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EventEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /** 将日程移入回收站 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 日程已移入回收站 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新日程 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        title?: string;
                        description?: string;
                        /** Format: date-time */
                        startAt?: string;
                        /** Format: date-time */
                        endAt?: string;
                        /**
                         * @default GENERAL
                         * @enum {string}
                         */
                        eventType?: "GENERAL" | "MEETING" | "MEDICAL" | "TRAVEL" | "REST";
                        /**
                         * @default NORMAL
                         * @enum {string}
                         */
                        priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                        isImmovable?: boolean;
                        allowOverlap?: boolean;
                        expectedVersion: number;
                        /** @enum {string} */
                        status?: "SCHEDULED" | "COMPLETED" | "CANCELLED";
                    };
                };
            };
            responses: {
                /** @description 更新后的日程 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EventEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/reminders/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除提醒定义 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新提醒定义 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        /** @enum {string} */
                        triggerMode?: "ABSOLUTE" | "OFFSET_BEFORE_START" | "OFFSET_BEFORE_DUE";
                        /** Format: date-time */
                        triggerAt?: string | null;
                        offsetMinutes?: number | null;
                        isEnabled?: boolean;
                    };
                };
            };
            responses: {
                /** @description 已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ReminderEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/ai/providers/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除 AI Provider 配置及其凭据 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description Provider 已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新 AI Provider 配置 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        displayName?: string;
                        /** Format: uri */
                        baseUrl?: string | null;
                        modelId?: string;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AiProviderEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/holidays:update": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 联网更新节假日安排 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        year?: number;
                    };
                };
            };
            responses: {
                /** @description 更新结果 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["HolidayUpdateResultEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 节假日来源不可用 */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/holidays/{date}/override": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 移除节假日用户覆盖 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    date: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 移除结果 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["HolidayOverrideRemoveEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/chats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 列出或搜索 AI 会话 */
        get: {
            parameters: {
                query?: {
                    q?: string;
                    includeArchived?: "true" | "false";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 会话列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChatSessionsEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        /** 创建 AI 会话 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        title: string;
                        providerConfigId: string;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChatSessionEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/chats/{id}/messages": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 读取会话消息 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 消息列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChatMessagesEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        /** 发送消息并创建运行 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        content: string;
                        context?: {
                            /** @enum {string} */
                            source: "TODAY";
                            /** Format: date */
                            date: string;
                            timeZone: string;
                            /** Format: date-time */
                            currentTime: string;
                            pressure: {
                                score: number;
                                /** @enum {string} */
                                level: "RELAXED" | "COMFORTABLE" | "ELEVATED" | "HIGH_PRESSURE";
                            };
                            totals: {
                                sleepMinutes: number;
                                workMinutes: number;
                                lifeMinutes: number;
                                freeMinutes: number;
                            };
                            currentBlock: {
                                title: string;
                                /** @enum {string} */
                                kind: "TASK" | "EVENT" | "SLEEP" | "REST";
                                /** @enum {string} */
                                area: "WORK" | "LIFE" | "SLEEP";
                                /** Format: date-time */
                                startAt: string;
                                /** Format: date-time */
                                endAt: string;
                            } | null;
                            upcoming: {
                                title: string;
                                /** @enum {string} */
                                kind: "TASK" | "EVENT";
                                /** @enum {string} */
                                area: "WORK" | "LIFE";
                                /** Format: date-time */
                                startAt: string;
                                /** Format: date-time */
                                endAt: string;
                            }[];
                        };
                    };
                };
            };
            responses: {
                /** @description 运行已排队 */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SendChatMessageEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/runs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 读取 AI 运行状态 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 运行状态 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AiRunEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/runs/{id}:cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 取消 AI 运行 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 已取消 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AiRunEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/change-sets/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 读取 AI 操作的变更详情 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 变更集详情 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AiChangeSetEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/change-sets/{id}:undo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 撤销 AI 创建操作 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 已撤销的变更集 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AiChangeSetEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/providers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 列出 AI Provider 配置 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Provider 列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AiProviderConfigsEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        /** 创建 AI Provider 配置 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        providerType: "OPENAI" | "ANTHROPIC" | "GOOGLE" | "OPENAI_COMPATIBLE";
                        displayName: string;
                        /** Format: uri */
                        baseUrl?: string | null;
                        modelId: string;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AiProviderEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/routine-overrides/{date}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 读取日期作息覆盖 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    date: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 日期作息覆盖（无覆盖时为 null） */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                id: string;
                                /** Format: date */
                                localDate: string;
                                templateId: string | null;
                                segments: {
                                    name: string;
                                    /** @enum {string} */
                                    segmentType: "SLEEP" | "WORK" | "LIFE" | "REST";
                                    startTime: string;
                                    endTime: string;
                                    isImmovable: boolean;
                                }[] | null;
                                note: string | null;
                            } | null;
                            meta: {
                                requestId: string;
                            };
                        };
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        /** 设置日期作息覆盖 */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    date: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        templateId: string;
                        note?: string;
                    } | {
                        segments: {
                            name: string;
                            /** @enum {string} */
                            segmentType: "SLEEP" | "WORK" | "LIFE" | "REST";
                            startTime: string;
                            endTime: string;
                            isImmovable: boolean;
                        }[];
                        note?: string;
                    };
                };
            };
            responses: {
                /** @description 覆盖已保存 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data: {
                                id: string;
                                /** Format: date */
                                localDate: string;
                                templateId: string | null;
                                segments: {
                                    name: string;
                                    /** @enum {string} */
                                    segmentType: "SLEEP" | "WORK" | "LIFE" | "REST";
                                    startTime: string;
                                    endTime: string;
                                    isImmovable: boolean;
                                }[] | null;
                                note: string | null;
                            };
                            meta: {
                                requestId: string;
                            };
                        };
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        post?: never;
        /** 删除日期作息覆盖 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    date: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 覆盖已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/providers/{id}/credential": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** 写入 AI Provider 凭据 */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        secret: string;
                    };
                };
            };
            responses: {
                /** @description 凭据已写入 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        post?: never;
        /** 删除 AI Provider 凭据 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 凭据已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/providers/{id}:verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 验证 AI Provider 连通性与能力 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 验证完成 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AiProviderEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/providers/{id}:set-default": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 将 AI Provider 设为默认 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 默认 Provider 已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AiProviderEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/settings/ai-memory:clear-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 预检清空 AI 记忆 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 清空预检 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ClearAiMemoryPreviewEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/settings/ai-memory:clear-confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 确认清空 AI 记忆 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        confirmationId: string;
                        count: number;
                    };
                };
            };
            responses: {
                /** @description 已清空 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ClearAiMemoryConfirmEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/demo-data": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 获取演示数据状态 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 演示数据状态 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DemoDataStatusEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/demo-data/clear-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 预检清空演示数据 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 清空预检 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DemoDataClearPreviewEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/demo-data/clear": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 清空演示数据 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        confirmationId: string;
                        confirmationToken: string;
                    };
                };
            };
            responses: {
                /** @description 已清空 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MutationEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/setup/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 获取首次启动状态 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 启动状态 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SetupStatusEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/change-sets/{id}:undo-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 撤销最近变更预览 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 确认预览 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ConfirmationPreviewEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/change-sets/{id}:redo-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 重做已撤销变更预览 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 确认预览 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ConfirmationPreviewEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/setup/initialize": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 初始化本地数据目录 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        dataDirectory: string;
                        /** @default true */
                        includeDemoData?: boolean;
                        /**
                         * @default WEEKLY
                         * @enum {string}
                         */
                        backupFrequency?: "DAILY" | "WEEKLY" | "MANUAL";
                        /** @default 8 */
                        backupRetentionCount?: number;
                        /**
                         * @default INBOX
                         * @enum {string}
                         */
                        quickCaptureDefaultAction?: "INBOX" | "AI";
                        routineTemplates?: {
                            /** @enum {string} */
                            templateType: "WORKDAY" | "WEEKEND" | "HOLIDAY";
                            segments: {
                                name: string;
                                /** @enum {string} */
                                segmentType: "SLEEP" | "WORK" | "LIFE" | "REST";
                                startTime: string;
                                endTime: string;
                                isImmovable: boolean;
                            }[];
                        }[];
                        aiProvider?: {
                            /** @enum {string} */
                            providerType: "OPENAI" | "ANTHROPIC" | "GOOGLE" | "OPENAI_COMPATIBLE";
                            displayName: string;
                            /** Format: uri */
                            baseUrl?: string;
                            modelId: string;
                            apiKey: string;
                        };
                    };
                };
            };
            responses: {
                /** @description 初始化完成 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SetupStatusEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 获取本地会话和 CSRF Token */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 本地会话 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SessionEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/settings/data-directory/migration-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 预检数据目录迁移并签发确认令牌 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        dataDirectory: string;
                    };
                };
            };
            responses: {
                /** @description 迁移影响预览 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DataDirectoryMigrationPreviewEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/settings/data-directory/migrate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 执行已确认的数据目录迁移 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        dataDirectory: string;
                        confirmationId: string;
                        confirmationToken: string;
                    };
                };
            };
            responses: {
                /** @description 数据目录已切换 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SetupStatusEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 获取普通设置 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 设置列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SettingsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** 批量更新普通设置 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        values: {
                            [key: string]: string | number | boolean | unknown[] | {
                                [key: string]: unknown;
                            };
                        };
                    };
                };
            };
            responses: {
                /** @description 更新后的设置 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SettingsEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/settings/schema": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 获取设置定义 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 设置定义 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SettingsSchemaEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 获取分类 */
        get: {
            parameters: {
                query?: {
                    includeArchived?: boolean | null;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 分类列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CategoriesEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 新建分类 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        parentArea: "WORK" | "LIFE";
                        /** @enum {string} */
                        moduleType: "SELF_MEDIA" | "DEVELOPMENT" | "LEARNING" | "SHOPPING" | "DIET" | "FITNESS" | "ENTERTAINMENT" | "GENERIC";
                        name: string;
                        description?: string;
                    };
                };
            };
            responses: {
                /** @description 分类已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CategoryEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/categories/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** 更新分类 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        name?: string;
                        description?: string | null;
                    };
                };
            };
            responses: {
                /** @description 分类已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CategoryEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/categories:reorder": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 原子重排分类 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        parentArea: "WORK" | "LIFE";
                        ids: string[];
                        expectedOrderVersion: number;
                    };
                };
            };
            responses: {
                /** @description 分类已重排 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CategoriesEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/categories/{id}/archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 归档分类 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 分类状态已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CategoryEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/categories/{id}/unarchive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 恢复分类 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 分类状态已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CategoryEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tags": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 获取标签 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 标签列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TagsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 新建标签 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name: string;
                        /** @enum {string} */
                        colorToken?: "slate" | "blue" | "green" | "amber" | "red" | "purple";
                        description?: string;
                    };
                };
            };
            responses: {
                /** @description 标签已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TagEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tags/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 软删除标签 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        confirmationId: string;
                        confirmationToken: string;
                    };
                };
            };
            responses: {
                /** @description 标签已进入回收站 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 修改标签 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        name?: string;
                        /** @enum {string|null} */
                        colorToken?: "slate" | "blue" | "green" | "amber" | "red" | "purple" | null;
                        description?: string | null;
                    };
                };
            };
            responses: {
                /** @description 标签已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TagEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/tags/{id}/delete-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 预览标签删除影响并签发确认令牌 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 删除影响预览 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DeleteTagPreviewEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/backups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 备份记录 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 备份记录列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BackupRecordsEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        /** 创建手动完整备份 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 备份已生成 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BackupEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/backups/restore-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 备份恢复预检 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        path: string;
                    };
                };
            };
            responses: {
                /** @description 恢复预检 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BackupRestorePreviewEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/backups/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 执行备份恢复 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        path: string;
                        confirmationId: string;
                        confirmationToken: string;
                    };
                };
            };
            responses: {
                /** @description 恢复完成 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SetupStatusEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attachments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 上传并复制附件到受控数据目录 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        /** Format: binary */
                        file: string;
                    };
                };
            };
            responses: {
                /** @description 附件已保存 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AttachmentEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attachments/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 获取附件元数据 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 附件元数据 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AttachmentEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/goals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 目标列表 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 目标 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GoalsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建目标 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId: string;
                        title: string;
                        description?: string;
                        /**
                         * @default OUTCOME
                         * @enum {string}
                         */
                        goalType?: "OUTCOME" | "HABIT";
                        /** @enum {string} */
                        status?: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
                        /** Format: date */
                        startDate: string;
                        /** Format: date */
                        endDate?: string | null;
                    };
                };
            };
            responses: {
                /** @description 目标已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GoalEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/goals/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 将目标移入回收站 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 目标已移入回收站 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新目标 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId?: string;
                        title?: string;
                        description?: string;
                        /**
                         * @default OUTCOME
                         * @enum {string}
                         */
                        goalType?: "OUTCOME" | "HABIT";
                        /** @enum {string} */
                        status?: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
                        /** Format: date */
                        startDate?: string;
                        /** Format: date */
                        endDate?: string | null;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 目标已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GoalEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/goals/{id}/set-progress": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 设置目标进度 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        value: number | null;
                    };
                };
            };
            responses: {
                /** @description 进度已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GoalEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/goals/{id}/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 目标量化指标与进度记录 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 目标指标状态 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GoalMetricsStateEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        /** 创建目标量化指标 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        name: string;
                        /** @enum {string} */
                        metricType: "NUMBER" | "COUNT" | "DURATION" | "PERCENTAGE" | "BOOLEAN";
                        unit?: string | null;
                        startValue?: number | null;
                        targetValue: number;
                        /** @enum {string} */
                        direction: "INCREASE" | "DECREASE" | "MAINTAIN";
                        /** @default 1 */
                        weight?: number;
                    };
                };
            };
            responses: {
                /** @description 目标指标已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GoalMetricsStateEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/goal-metrics/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除目标量化指标 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 目标指标已删除 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GoalMetricsStateEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新目标量化指标 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        name?: string;
                        /** @enum {string} */
                        metricType?: "NUMBER" | "COUNT" | "DURATION" | "PERCENTAGE" | "BOOLEAN";
                        unit?: string | null;
                        startValue?: number | null;
                        targetValue?: number;
                        /** @enum {string} */
                        direction?: "INCREASE" | "DECREASE" | "MAINTAIN";
                        /** @default 1 */
                        weight?: number;
                    };
                };
            };
            responses: {
                /** @description 目标指标已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GoalMetricsStateEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/goals/{id}/progress-entries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 录入目标指标进度 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        metricId: string;
                        value: number;
                        /** Format: date-time */
                        recordedAt?: string;
                        note?: string;
                    };
                };
            };
            responses: {
                /** @description 目标进度已录入 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GoalMetricsStateEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/plans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 计划列表 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 计划 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PlansEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建计划 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        goalId?: string | null;
                        categoryId: string;
                        title: string;
                        description?: string;
                        /**
                         * @default NORMAL
                         * @enum {string}
                         */
                        priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                        /** Format: date */
                        startDate: string;
                        /** Format: date */
                        endDate: string;
                    };
                };
            };
            responses: {
                /** @description 计划已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PlanEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/plans/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 将计划移入回收站 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 计划已移入回收站 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新计划 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        goalId?: string | null;
                        categoryId?: string;
                        title?: string;
                        description?: string;
                        /**
                         * @default NORMAL
                         * @enum {string}
                         */
                        priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                        /** Format: date */
                        startDate?: string;
                        /** Format: date */
                        endDate?: string;
                        expectedVersion: number;
                        /** @enum {string} */
                        status?: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
                    };
                };
            };
            responses: {
                /** @description 计划已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PlanEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/plans/{id}/milestones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 计划里程碑列表 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 计划里程碑 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PlanMilestonesEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        /** 创建计划里程碑 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        title: string;
                        description?: string;
                        /** Format: date-time */
                        dueAt: string;
                        /** @default [] */
                        linkedEntityIds?: string[];
                    };
                };
            };
            responses: {
                /** @description 计划里程碑已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PlanMilestoneEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/milestones/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 将计划里程碑移入回收站 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 计划里程碑已移入回收站 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新计划里程碑 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        title?: string;
                        description?: string;
                        /** Format: date-time */
                        dueAt?: string;
                        /** @default [] */
                        linkedEntityIds?: string[];
                        expectedVersion: number;
                        /** @enum {string} */
                        status?: "PENDING" | "AT_RISK" | "ACHIEVED" | "MISSED";
                    };
                };
            };
            responses: {
                /** @description 计划里程碑已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PlanMilestoneEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/tasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 任务列表 */
        get: {
            parameters: {
                query?: {
                    includeCompleted?: boolean | null;
                    from?: string;
                    to?: string;
                    area?: "WORK" | "LIFE";
                    ids?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 任务 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TasksEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建任务 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId: string;
                        planId?: string | null;
                        goalId?: string | null;
                        parentTaskId?: string | null;
                        title: string;
                        description?: string;
                        /**
                         * @default NORMAL
                         * @enum {string}
                         */
                        priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                        /** Format: date-time */
                        dueAt: string;
                        estimatedMinutes: number;
                        /** @default true */
                        isFlexible?: boolean;
                        /** @default false */
                        isSplittable?: boolean;
                        /** @enum {string} */
                        preferredArea: "WORK" | "LIFE";
                    };
                };
            };
            responses: {
                /** @description 任务已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TaskEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tasks/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 任务详情 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 任务 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TaskEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /** 将任务移入回收站 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 任务已移入回收站 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新任务 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        title?: string;
                        description?: string;
                        /**
                         * @default NORMAL
                         * @enum {string}
                         */
                        priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                        /** Format: date-time */
                        dueAt?: string;
                        estimatedMinutes?: number;
                        /** @default true */
                        isFlexible?: boolean;
                        /** @default false */
                        isSplittable?: boolean;
                        /** @enum {string} */
                        preferredArea?: "WORK" | "LIFE";
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 任务已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TaskEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/tasks/{id}/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 任务状态操作：start */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 任务状态已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TaskEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tasks/{id}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 任务状态操作：complete */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 任务状态已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TaskEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tasks/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 任务状态操作：cancel */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 任务状态已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TaskEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tasks/{id}/reopen": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 任务状态操作：reopen */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 任务状态已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TaskEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tasks/{id}/subtasks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 创建一层子任务 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId: string;
                        planId?: string | null;
                        goalId?: string | null;
                        title: string;
                        description?: string;
                        /**
                         * @default NORMAL
                         * @enum {string}
                         */
                        priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                        /** Format: date-time */
                        dueAt: string;
                        estimatedMinutes: number;
                        /** @default true */
                        isFlexible?: boolean;
                        /** @default false */
                        isSplittable?: boolean;
                        /** @enum {string} */
                        preferredArea: "WORK" | "LIFE";
                    };
                };
            };
            responses: {
                /** @description 子任务已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TaskEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 日程列表 */
        get: {
            parameters: {
                query?: {
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 日程 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EventsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建日程 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId: string;
                        title: string;
                        description?: string;
                        /** Format: date-time */
                        startAt: string;
                        /** Format: date-time */
                        endAt: string;
                        /**
                         * @default GENERAL
                         * @enum {string}
                         */
                        eventType?: "GENERAL" | "MEETING" | "MEDICAL" | "TRAVEL" | "REST";
                        /**
                         * @default NORMAL
                         * @enum {string}
                         */
                        priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                        isImmovable?: boolean;
                        allowOverlap?: boolean;
                    };
                };
            };
            responses: {
                /** @description 日程已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EventEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/events/conflicts:check": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 检查日程冲突 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: date-time */
                        startAt: string;
                        /** Format: date-time */
                        endAt: string;
                        excludeId?: string;
                    };
                };
            };
            responses: {
                /** @description 冲突列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EventsEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/routine-templates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 作息模板列表 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 作息模板 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RoutineTemplatesEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建作息模板 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name: string;
                        /** @enum {string} */
                        templateType: "WORKDAY" | "WEEKEND" | "HOLIDAY" | "CUSTOM";
                        isDefault?: boolean;
                        segments: {
                            name: string;
                            /** @enum {string} */
                            segmentType: "SLEEP" | "WORK" | "LIFE" | "REST";
                            startTime: string;
                            endTime: string;
                            isImmovable: boolean;
                        }[];
                    };
                };
            };
            responses: {
                /** @description 作息模板已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RoutineTemplateEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/routine-templates/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** 更新作息模板 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        name?: string;
                        segments?: {
                            name: string;
                            /** @enum {string} */
                            segmentType: "SLEEP" | "WORK" | "LIFE" | "REST";
                            startTime: string;
                            endTime: string;
                            isImmovable: boolean;
                        }[];
                    };
                };
            };
            responses: {
                /** @description 作息模板已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RoutineTemplateEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/routine-templates/{id}/set-default": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 设为默认作息 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 默认作息已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RoutineTemplateEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/holidays": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 节假日列表 */
        get: {
            parameters: {
                query?: {
                    year?: number | null;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 节假日 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["HolidaysEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recurrence-rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 创建重复规则 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        targetType: "TASK_TEMPLATE" | "EVENT_TEMPLATE";
                        targetEntityId: string;
                        rrule: string;
                        dtstartLocal: string;
                        generationHorizonDays?: number;
                    };
                };
            };
            responses: {
                /** @description 重复规则已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RecurrenceRuleEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recurrence-rules/by-target/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 按任务或日程获取重复规则 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 目标关联的重复规则或空值 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["NullableRecurrenceRuleEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recurrence-rules/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 重复规则详情 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 重复规则 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RecurrenceRuleEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recurrence-rules/{id}/occurrences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 重复规则实例列表 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 重复实例及系列关系 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RecurrenceOccurrencesEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recurrence-rules/{id}/modify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 统一修改重复事项 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        /** @enum {string} */
                        action: "ONLY_THIS" | "THIS_AND_FUTURE" | "ENTIRE_SERIES" | "SKIP_ONCE" | "END_RECURRENCE";
                        recurrenceKey: string;
                        rrule?: string;
                        override?: {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            responses: {
                /** @description 当前规则已修改 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RecurrenceRuleEnvelope"];
                    };
                };
                /** @description 已切分并创建未来规则 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RecurrenceRuleEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recurrence-rules/{id}/exceptions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 设置单次重复例外 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        recurrenceKey: string;
                        /** @enum {string} */
                        type: "SKIP" | "OVERRIDE";
                        override?: {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            responses: {
                /** @description 例外已保存 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recurrence-rules/{id}/split": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 从本次起切分规则 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        splitLocal: string;
                        rrule: string;
                    };
                };
            };
            responses: {
                /** @description 规则已切分 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RecurrenceRuleEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/schedules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 排程时间块 */
        get: {
            parameters: {
                query: {
                    from: string;
                    to: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 排程时间块 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TimelineEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/schedules:reschedule": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 执行确定性重排 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: date-time */
                        rangeStart: string;
                        /** Format: date-time */
                        rangeEnd: string;
                        /** @default MANUAL */
                        reason?: string;
                    };
                };
            };
            responses: {
                /** @description 排程结果 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ScheduleRunEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/schedules/warnings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 排程警告 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 警告 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ScheduleWarningsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/schedules/runs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 排程运行详情与历史 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 一次排程运行的触发、影响任务、新块/释放块与警告 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ScheduleRunDetailEnvelope"];
                    };
                };
                /** @description 排程运行不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/tasks/{id}/schedule-history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 任务调度历史 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 任务维度的排程/重排/释放/失败历史 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TaskScheduleHistoryEnvelope"];
                    };
                };
                /** @description 任务不存在 */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 服务就绪检查 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 服务已就绪 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SystemStatus"];
                    };
                };
                /** @description 服务尚未就绪 */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/today": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 今日完整驾驶舱 */
        get: {
            parameters: {
                query?: {
                    date?: string;
                    area?: "WORK" | "LIFE";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 今日完整驾驶舱 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TodayEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/today/timeline": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 今日 24 小时时间流 */
        get: {
            parameters: {
                query?: {
                    date?: string;
                    area?: "WORK" | "LIFE";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 今日 24 小时时间流 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TimelineEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/today/plan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 今日计划 */
        get: {
            parameters: {
                query?: {
                    date?: string;
                    area?: "WORK" | "LIFE";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 今日计划 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TodayPlanEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/today/free-time": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 今日连续空闲时段 */
        get: {
            parameters: {
                query?: {
                    date?: string;
                    area?: "WORK" | "LIFE";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 今日连续空闲时段 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["FreeTimeEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/today/totals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 今日四类时间统计 */
        get: {
            parameters: {
                query?: {
                    date?: string;
                    area?: "WORK" | "LIFE";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 今日四类时间统计 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TodayTotalsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/today/pressure": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 今日压力指数 */
        get: {
            parameters: {
                query?: {
                    date?: string;
                    area?: "WORK" | "LIFE";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 今日压力指数 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PressureEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 工作综合驾驶舱 */
        get: {
            parameters: {
                query?: {
                    range?: "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 工作综合驾驶舱 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkOverviewEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/statistics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 工作趋势与明细 */
        get: {
            parameters: {
                query?: {
                    range?: "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 工作趋势与明细 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkOverviewEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/entertainment/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 娱乐清单 */
        get: {
            parameters: {
                query?: {
                    itemType?: "MOVIE" | "SERIES" | "BOOK" | "COMIC" | "GAME" | "ACTIVITY" | "TRIP" | "OTHER";
                    listType?: "WANT_TO_WATCH" | "WANT_TO_PLAY" | "WANT_TO_GO" | "OTHER";
                    status?: "WISHLIST" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "DROPPED";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 娱乐清单 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EntertainmentItemsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建娱乐条目 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId: string;
                        title: string;
                        /** @enum {string} */
                        itemType: "MOVIE" | "SERIES" | "BOOK" | "COMIC" | "GAME" | "ACTIVITY" | "TRIP" | "OTHER";
                        /** @enum {string} */
                        listType: "WANT_TO_WATCH" | "WANT_TO_PLAY" | "WANT_TO_GO" | "OTHER";
                        /** @enum {string} */
                        status?: "WISHLIST" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "DROPPED";
                        progressTotal?: number | null;
                        progressUnit?: string | null;
                        note?: string | null;
                    };
                };
            };
            responses: {
                /** @description 娱乐条目已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EntertainmentItemEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/entertainment/items/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除娱乐条目 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 娱乐条目已移入回收站 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新娱乐条目 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        title?: string;
                        /** @enum {string} */
                        itemType?: "MOVIE" | "SERIES" | "BOOK" | "COMIC" | "GAME" | "ACTIVITY" | "TRIP" | "OTHER";
                        /** @enum {string} */
                        listType?: "WANT_TO_WATCH" | "WANT_TO_PLAY" | "WANT_TO_GO" | "OTHER";
                        /** @enum {string} */
                        status?: "WISHLIST" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "DROPPED";
                        progressTotal?: number | null;
                        progressUnit?: string | null;
                        note?: string | null;
                    };
                };
            };
            responses: {
                /** @description 娱乐条目已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EntertainmentItemEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/life/entertainment/sessions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除娱乐时长记录 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 娱乐时长记录已移入回收站 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新娱乐时长记录 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        /** Format: date */
                        sessionDate?: string;
                        durationMinutes?: number;
                        progressDelta?: number | null;
                        note?: string | null;
                    };
                };
            };
            responses: {
                /** @description 娱乐时长记录已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EntertainmentSessionEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/life/entertainment/items/{id}/set-progress": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 更新娱乐进度 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        progressCurrent: number;
                        /** @enum {string} */
                        status?: "WISHLIST" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "DROPPED";
                        rating?: number | null;
                    };
                };
            };
            responses: {
                /** @description 娱乐进度已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EntertainmentItemEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/entertainment/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 娱乐时长记录 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 娱乐时长记录 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EntertainmentSessionsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 记录娱乐时长 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        itemId: string;
                        /** Format: date */
                        sessionDate: string;
                        durationMinutes: number;
                        progressDelta?: number | null;
                        note?: string | null;
                    };
                };
            };
            responses: {
                /** @description 娱乐时长已记录 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EntertainmentSessionEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/entertainment/items/{id}/trip-details": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** 保存活动旅行详情 */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: date-time */
                        startAt?: string | null;
                        /** Format: date-time */
                        endAt?: string | null;
                        location?: string | null;
                        eventId?: string | null;
                        taskId?: string | null;
                        details?: {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            responses: {
                /** @description 详情已保存 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EntertainmentItemEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/entertainment/items/{id}/expense": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 记录娱乐支出 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: date-time */
                        occurredAt: string;
                        amountMinor: number;
                        merchant?: string | null;
                        note?: string | null;
                    };
                };
            };
            responses: {
                /** @description 娱乐支出已记录 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EntertainmentItemEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/self-media/contents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 自媒体内容列表 */
        get: {
            parameters: {
                query?: {
                    status?: "IDEA" | "PLANNING" | "CREATING" | "READY" | "PUBLISHED" | "ARCHIVED";
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 内容列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SelfMediaContentsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建自媒体内容 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId: string;
                        title: string;
                        idea?: string | null;
                        script?: string | null;
                        /** @enum {string} */
                        contentType: "VIDEO" | "ARTICLE" | "AUDIO" | "IMAGE" | "OTHER";
                        platform?: string | null;
                        /** @enum {string} */
                        productionStatus?: "IDEA" | "PLANNING" | "CREATING" | "READY" | "PUBLISHED" | "ARCHIVED";
                        /** Format: date-time */
                        plannedPublishAt?: string | null;
                        /** Format: date-time */
                        publishedAt?: string | null;
                        calendarEventId?: string | null;
                        taskId?: string | null;
                    };
                };
            };
            responses: {
                /** @description 内容已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SelfMediaContentEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/self-media/contents/{id}/transition": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 流转制作状态 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        /** @enum {string} */
                        status: "IDEA" | "PLANNING" | "CREATING" | "READY" | "PUBLISHED" | "ARCHIVED";
                        /** Format: date-time */
                        publishedAt?: string | null;
                    };
                };
            };
            responses: {
                /** @description 状态已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SelfMediaContentEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/self-media/contents/{id}/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 内容表现指标 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 指标列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SelfMediaMetricsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 录入内容表现 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: date */
                        recordedDate: string;
                        platform: string;
                        views?: number | null;
                        likes?: number | null;
                        comments?: number | null;
                        favorites?: number | null;
                        shares?: number | null;
                        followerDelta?: number | null;
                        customMetrics?: {
                            [key: string]: number;
                        };
                    };
                };
            };
            responses: {
                /** @description 指标已录入 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SelfMediaMetricEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/dev-projects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 开发项目列表 */
        get: {
            parameters: {
                query?: {
                    status?: "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 项目列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DevProjectsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建开发项目 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId: string;
                        name: string;
                        summary?: string | null;
                        /** @enum {string} */
                        status?: "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
                        /** Format: date */
                        startDate?: string | null;
                        /** Format: date */
                        targetDate?: string | null;
                        planId?: string | null;
                    };
                };
            };
            responses: {
                /** @description 项目已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DevProjectEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/dev-projects/{id}/features": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 项目功能清单 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 项目功能清单 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DevFeaturesEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 新增项目功能清单 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        title: string;
                        description?: string | null;
                        /**
                         * @default BACKLOG
                         * @enum {string}
                         */
                        status?: "BACKLOG" | "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
                        /**
                         * @default NORMAL
                         * @enum {string}
                         */
                        priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                        taskId?: string | null;
                        milestoneId?: string | null;
                        /** @default 0 */
                        sortOrder?: number;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DevFeatureEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/dev-projects/{id}/defects": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 项目缺陷 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 项目缺陷 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DevDefectsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 新增项目缺陷 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        featureId?: string | null;
                        taskId?: string | null;
                        title: string;
                        description?: string | null;
                        reproductionSteps?: string | null;
                        /**
                         * @default MEDIUM
                         * @enum {string}
                         */
                        severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
                        /**
                         * @default OPEN
                         * @enum {string}
                         */
                        status?: "OPEN" | "CONFIRMED" | "FIXING" | "RESOLVED" | "CLOSED" | "WONT_FIX";
                        foundVersion?: string | null;
                        resolvedVersion?: string | null;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DevDefectEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/dev-projects/{id}/repositories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 项目仓库链接 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 项目仓库链接 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RepositoryLinksEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 新增项目仓库链接 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name: string;
                        /** Format: uri */
                        url: string;
                        description?: string | null;
                        /** @default 0 */
                        sortOrder?: number;
                    };
                };
            };
            responses: {
                /** @description 已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RepositoryLinkEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/learning/resources": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 学习资源列表 */
        get: {
            parameters: {
                query?: {
                    status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "PAUSED" | "ABANDONED";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 学习资源 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LearningResourcesEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建学习资源 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId: string;
                        title: string;
                        /** @enum {string} */
                        resourceType: "COURSE" | "BOOK" | "ARTICLE" | "VIDEO" | "DOCUMENT" | "OTHER";
                        author?: string | null;
                        /** Format: uri */
                        sourceUrl?: string | null;
                        /** @enum {string} */
                        status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "PAUSED" | "ABANDONED";
                        progressCurrent?: number | null;
                        progressTotal?: number | null;
                        progressUnit?: string | null;
                    };
                };
            };
            responses: {
                /** @description 学习资源已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LearningResourceEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/learning/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 学习时长记录 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 学习记录 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LearningSessionsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 记录学习时长 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        resourceId?: string | null;
                        planId?: string | null;
                        taskId?: string | null;
                        /** Format: date */
                        sessionDate: string;
                        durationMinutes: number;
                        progressDelta?: number | null;
                        summary?: string | null;
                    };
                };
            };
            responses: {
                /** @description 学习记录已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LearningSessionEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/self-media/calendar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 自媒体发布日历 */
        get: {
            parameters: {
                query?: {
                    range?: "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 自媒体发布日历 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SelfMediaContentsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/self-media/statistics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 自媒体表现趋势 */
        get: {
            parameters: {
                query?: {
                    range?: "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 自媒体表现趋势 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SelfMediaTrendEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/self-media/contents/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除自媒体内容 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 自媒体内容已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新自媒体内容 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        title?: string;
                        idea?: string | null;
                        script?: string | null;
                        /** @enum {string} */
                        contentType?: "VIDEO" | "ARTICLE" | "AUDIO" | "IMAGE" | "OTHER";
                        platform?: string | null;
                        /** @enum {string} */
                        productionStatus?: "IDEA" | "PLANNING" | "CREATING" | "READY" | "PUBLISHED" | "ARCHIVED";
                        /** Format: date-time */
                        plannedPublishAt?: string | null;
                        /** Format: date-time */
                        publishedAt?: string | null;
                        calendarEventId?: string | null;
                        taskId?: string | null;
                    };
                };
            };
            responses: {
                /** @description 自媒体内容已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SelfMediaContentEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/work/self-media/metrics/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除自媒体指标 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 自媒体指标已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新自媒体指标 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: date */
                        recordedDate?: string;
                        platform?: string;
                        views?: number | null;
                        likes?: number | null;
                        comments?: number | null;
                        favorites?: number | null;
                        shares?: number | null;
                        followerDelta?: number | null;
                        customMetrics?: {
                            [key: string]: number;
                        };
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 自媒体指标已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SelfMediaMetricEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/work/dev-projects/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除开发项目 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 开发项目已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新开发项目 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name?: string;
                        summary?: string | null;
                        /** @enum {string} */
                        status?: "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
                        /** Format: date */
                        startDate?: string | null;
                        /** Format: date */
                        targetDate?: string | null;
                        planId?: string | null;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 开发项目已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DevProjectEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/work/dev-features/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除开发功能 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 开发功能已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新开发功能 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        title?: string;
                        description?: string | null;
                        /**
                         * @default BACKLOG
                         * @enum {string}
                         */
                        status?: "BACKLOG" | "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
                        /**
                         * @default NORMAL
                         * @enum {string}
                         */
                        priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                        taskId?: string | null;
                        milestoneId?: string | null;
                        /** @default 0 */
                        sortOrder?: number;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 开发功能已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DevFeatureEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/work/dev-defects/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除开发缺陷 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 开发缺陷已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新开发缺陷 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        featureId?: string | null;
                        taskId?: string | null;
                        title?: string;
                        description?: string | null;
                        reproductionSteps?: string | null;
                        /**
                         * @default MEDIUM
                         * @enum {string}
                         */
                        severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
                        /**
                         * @default OPEN
                         * @enum {string}
                         */
                        status?: "OPEN" | "CONFIRMED" | "FIXING" | "RESOLVED" | "CLOSED" | "WONT_FIX";
                        foundVersion?: string | null;
                        resolvedVersion?: string | null;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 开发缺陷已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DevDefectEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/work/repositories/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除仓库链接 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 仓库链接已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新仓库链接 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name?: string;
                        /** Format: uri */
                        url?: string;
                        description?: string | null;
                        /** @default 0 */
                        sortOrder?: number;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 仓库链接已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RepositoryLinkEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/work/learning/resources/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除学习资源 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 学习资源已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新学习资源 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        title?: string;
                        /** @enum {string} */
                        resourceType?: "COURSE" | "BOOK" | "ARTICLE" | "VIDEO" | "DOCUMENT" | "OTHER";
                        author?: string | null;
                        /** Format: uri */
                        sourceUrl?: string | null;
                        /** @enum {string} */
                        status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "PAUSED" | "ABANDONED";
                        progressCurrent?: number | null;
                        progressTotal?: number | null;
                        progressUnit?: string | null;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 学习资源已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LearningResourceEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/work/learning/sessions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除学习记录 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 学习记录已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新学习记录 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        resourceId?: string | null;
                        planId?: string | null;
                        taskId?: string | null;
                        /** Format: date */
                        sessionDate?: string;
                        durationMinutes?: number;
                        progressDelta?: number | null;
                        summary?: string | null;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 学习记录已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LearningSessionEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/work/dev-projects/{id}/milestones": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 项目里程碑 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 里程碑列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DevProjectMilestonesEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建项目里程碑 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        title: string;
                        description?: string | null;
                        /** Format: date-time */
                        dueAt: string;
                        /** @enum {string} */
                        status?: "PENDING" | "AT_RISK" | "ACHIEVED" | "MISSED";
                        taskId?: string | null;
                    };
                };
            };
            responses: {
                /** @description 里程碑已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DevProjectMilestoneEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/dev-milestones/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除项目里程碑 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 里程碑已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新项目里程碑 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        title?: string;
                        description?: string | null;
                        /** Format: date-time */
                        dueAt?: string;
                        /** @enum {string} */
                        status?: "PENDING" | "AT_RISK" | "ACHIEVED" | "MISSED";
                        taskId?: string | null;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 里程碑已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DevProjectMilestoneEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/work/entities/{id}/notes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 工作对象笔记 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 笔记列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkNotesEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建工作对象笔记 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId: string;
                        title: string;
                        /**
                         * @default MARKDOWN
                         * @enum {string}
                         */
                        editorMode?: "RICH_TEXT" | "MARKDOWN";
                        markdownContent?: string | null;
                        richContent?: unknown;
                        summary?: string | null;
                        /** @enum {string} */
                        role: "SCRIPT" | "TECHNICAL" | "KNOWLEDGE" | "MATERIAL" | "OTHER";
                    };
                };
            };
            responses: {
                /** @description 笔记已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkNoteEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/entities/{entityId}/notes/{noteId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除工作对象笔记 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    entityId: string;
                    noteId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 笔记已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新工作对象笔记 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    entityId: string;
                    noteId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        title?: string;
                        markdownContent?: string | null;
                        richContent?: unknown;
                        /** @enum {string} */
                        editorMode?: "RICH_TEXT" | "MARKDOWN";
                        summary?: string | null;
                        /** @enum {string} */
                        role?: "SCRIPT" | "TECHNICAL" | "KNOWLEDGE" | "MATERIAL" | "OTHER";
                    };
                };
            };
            responses: {
                /** @description 笔记已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkNoteEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/work/entities/{id}/attachments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 工作对象附件 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 附件列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LinkedAttachmentsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 关联工作对象附件 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        attachmentId: string;
                        /** @enum {string} */
                        role: "GENERAL" | "MATERIAL" | "DOCUMENT" | "COVER";
                    };
                };
            };
            responses: {
                /** @description 附件已关联 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/entities/{id}/attachments/{attachmentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 取消工作对象附件关联 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    attachmentId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 附件关联已取消 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/overview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 生活综合驾驶舱 */
        get: {
            parameters: {
                query?: {
                    range?: "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 生活综合驾驶舱 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LifeOverviewEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/statistics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 生活范围统计 */
        get: {
            parameters: {
                query?: {
                    range?: "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 生活范围统计 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LifeOverviewEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/shopping/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 待购清单 */
        get: {
            parameters: {
                query?: {
                    status?: "WANTED" | "RESEARCHING" | "READY" | "PURCHASED" | "CANCELLED";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 待购清单 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ShoppingItemsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建待购项 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId: string;
                        name: string;
                        productCategory?: string | null;
                        quantity?: number;
                        unit?: string | null;
                        plannedUnitPriceMinor?: number | null;
                        budgetAmountMinor?: number | null;
                        /** @enum {string} */
                        priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                        /** @enum {string} */
                        status?: "WANTED" | "RESEARCHING" | "READY" | "PURCHASED" | "CANCELLED";
                        purchaseChannel?: string | null;
                        taskId?: string | null;
                    };
                };
            };
            responses: {
                /** @description 待购项已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ShoppingItemEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/shopping/items/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除待购项 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 待购项已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新待购项 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name?: string;
                        productCategory?: string | null;
                        quantity?: number;
                        unit?: string | null;
                        plannedUnitPriceMinor?: number | null;
                        budgetAmountMinor?: number | null;
                        /** @enum {string} */
                        priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                        /** @enum {string} */
                        status?: "WANTED" | "RESEARCHING" | "READY" | "PURCHASED" | "CANCELLED";
                        purchaseChannel?: string | null;
                        taskId?: string | null;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 待购项已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ShoppingItemEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/life/shopping/items/{id}/purchase": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 完成购买并记账 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        quantity: number;
                        unitPriceMinor: number;
                        /** Format: date-time */
                        purchasedAt: string;
                        channel?: string | null;
                    };
                };
            };
            responses: {
                /** @description 购买已完成 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PurchaseRecordEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/shopping/purchases": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 购买历史 */
        get: {
            parameters: {
                query?: {
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 购买历史 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PurchaseRecordsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/budgets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 预算列表 */
        get: {
            parameters: {
                query?: {
                    range?: "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 预算列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BudgetsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建预算 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId?: string | null;
                        /** @enum {string|null} */
                        moduleType?: "SHOPPING" | "DIET" | "ENTERTAINMENT" | null;
                        /** @enum {string} */
                        periodType: "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";
                        /** Format: date */
                        periodStart: string;
                        /** Format: date */
                        periodEnd: string;
                        amountMinor: number;
                        alertThresholdPercent?: number;
                    };
                };
            };
            responses: {
                /** @description 预算已创建 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BudgetEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/diet/recipes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 食谱列表 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 食谱列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RecipesEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建食谱 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId: string;
                        name: string;
                        description?: string | null;
                        servings?: number;
                        caloriesKcal?: number | null;
                        proteinG?: number | null;
                        carbsG?: number | null;
                        fatG?: number | null;
                    };
                };
            };
            responses: {
                /** @description 创建食谱 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RecipeEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/diet/meal-plans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 餐食计划 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 餐食计划 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MealPlansEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建餐食计划 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId: string;
                        /** Format: date */
                        mealDate: string;
                        /** @enum {string} */
                        mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
                        /** Format: date-time */
                        plannedAt?: string | null;
                        recipeId?: string | null;
                        title: string;
                        eventId?: string | null;
                        taskId?: string | null;
                    };
                };
            };
            responses: {
                /** @description 创建餐食计划 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MealPlanEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/diet/meals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 餐食记录 */
        get: {
            parameters: {
                query?: {
                    from?: string;
                    to?: string;
                    mealType?: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 餐食记录 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MealRecordsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 记录餐食 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        caloriesKcal?: number | null;
                        proteinG?: number | null;
                        carbsG?: number | null;
                        fatG?: number | null;
                        categoryId: string;
                        mealPlanId?: string | null;
                        /** @enum {string} */
                        mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
                        title: string;
                        /** Format: date-time */
                        eatenAt: string;
                        fiberG?: number | null;
                        sodiumMg?: number | null;
                        otherNutrition?: {
                            [key: string]: unknown;
                        };
                        expenseAmountMinor?: number | null;
                        merchant?: string | null;
                    };
                };
            };
            responses: {
                /** @description 记录餐食 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MealRecordEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/diet/hydration": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 饮水记录 */
        get: {
            parameters: {
                query?: {
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 饮水记录 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["HydrationRecordsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 记录饮水 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: date-time */
                        recordedAt: string;
                        amountMl: number;
                        note?: string | null;
                    };
                };
            };
            responses: {
                /** @description 记录饮水 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["HydrationRecordEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/diet/preferences": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 饮食偏好 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 饮食偏好 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DietaryPreferencesEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建饮食偏好 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        preferenceType: "LIKE" | "DISLIKE" | "ALLERGY" | "INTOLERANCE" | "RESTRICTION";
                        name: string;
                        severity?: string | null;
                        note?: string | null;
                    };
                };
            };
            responses: {
                /** @description 创建饮食偏好 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DietaryPreferenceEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/diet/recipes/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除食谱 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 食谱已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新食谱 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name?: string;
                        description?: string | null;
                        servings?: number;
                        caloriesKcal?: number | null;
                        proteinG?: number | null;
                        carbsG?: number | null;
                        fatG?: number | null;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 食谱已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RecipeEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/life/diet/meal-plans/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 删除餐食计划 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 餐食计划已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新餐食计划 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: date */
                        mealDate?: string;
                        /** @enum {string} */
                        mealType?: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
                        /** Format: date-time */
                        plannedAt?: string | null;
                        recipeId?: string | null;
                        title?: string;
                        eventId?: string | null;
                        taskId?: string | null;
                        expectedVersion: number;
                        /** @enum {string} */
                        status?: "PLANNED" | "COMPLETED" | "SKIPPED";
                    };
                };
            };
            responses: {
                /** @description 餐食计划已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MealPlanEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/life/diet/meals/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 餐食记录已删除 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 餐食记录已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新餐食记录 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        caloriesKcal?: number | null;
                        proteinG?: number | null;
                        carbsG?: number | null;
                        fatG?: number | null;
                        expectedVersion: number;
                        /** @enum {string} */
                        mealType?: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
                        title?: string;
                        /** Format: date-time */
                        eatenAt?: string;
                        fiberG?: number | null;
                        sodiumMg?: number | null;
                        otherNutrition?: {
                            [key: string]: unknown;
                        };
                    };
                };
            };
            responses: {
                /** @description 更新餐食记录 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MealRecordEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/life/diet/hydration/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 饮水记录已删除 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 饮水记录已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新饮水记录 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: date-time */
                        recordedAt?: string;
                        amountMl?: number;
                        note?: string | null;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 更新饮水记录 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["HydrationRecordEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/life/diet/preferences/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 饮食偏好已删除 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 饮食偏好已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新饮食偏好 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        preferenceType?: "LIKE" | "DISLIKE" | "ALLERGY" | "INTOLERANCE" | "RESTRICTION";
                        name?: string;
                        severity?: string | null;
                        note?: string | null;
                        expectedVersion: number;
                        isActive?: boolean;
                    };
                };
            };
            responses: {
                /** @description 更新饮食偏好 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DietaryPreferenceEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/life/diet/meal-plans/{id}/complete": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 完成餐食计划 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        caloriesKcal?: number | null;
                        proteinG?: number | null;
                        carbsG?: number | null;
                        fatG?: number | null;
                        expectedVersion: number;
                        /** Format: date-time */
                        eatenAt: string;
                        expenseAmountMinor?: number | null;
                        merchant?: string | null;
                    };
                };
            };
            responses: {
                /** @description 餐食记录已生成 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MealRecordEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/diet/nutrition-summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 营养汇总 */
        get: {
            parameters: {
                query?: {
                    range?: "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 营养汇总 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LifeOverviewEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/fitness/exercises": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 动作库 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 动作库 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ExercisesEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建动作 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name: string;
                        /** @enum {string} */
                        exerciseType: "STRENGTH" | "CARDIO" | "MOBILITY" | "SPORT" | "OTHER";
                        muscleGroups?: string[];
                        defaultUnit?: string | null;
                        instructions?: string | null;
                    };
                };
            };
            responses: {
                /** @description 创建动作 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ExerciseEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/fitness/plans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 训练计划 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 训练计划 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkoutPlansEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建训练计划 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId: string;
                        name: string;
                        description?: string | null;
                        goalId?: string | null;
                        /** @enum {string} */
                        status?: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
                        items?: {
                            exerciseId: string;
                            setsTarget: number | null;
                            repsTarget: string | null;
                            weightTarget: number | null;
                            durationSecondsTarget: number | null;
                            distanceTarget: number | null;
                            sortOrder: number;
                        }[];
                    };
                };
            };
            responses: {
                /** @description 创建训练计划 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkoutPlanEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/fitness/sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 训练记录 */
        get: {
            parameters: {
                query?: {
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 训练记录 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkoutSessionsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 记录训练 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        categoryId: string;
                        workoutPlanId?: string | null;
                        taskId?: string | null;
                        /** Format: date-time */
                        startedAt: string;
                        /** Format: date-time */
                        endedAt: string;
                        caloriesBurned?: number | null;
                        perceivedEffort?: number | null;
                        note?: string | null;
                        sets?: {
                            exerciseId: string;
                            setNumber: number;
                            reps: number | null;
                            weight: number | null;
                            durationSeconds: number | null;
                            distance: number | null;
                            completed: boolean;
                        }[];
                    };
                };
            };
            responses: {
                /** @description 记录训练 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkoutSessionEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/fitness/body-measurements": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 身体指标 */
        get: {
            parameters: {
                query?: {
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 身体指标 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BodyMeasurementsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 记录身体指标 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: date-time */
                        measuredAt: string;
                        weightKg?: number | null;
                        bodyFatPercent?: number | null;
                        waistCm?: number | null;
                        chestCm?: number | null;
                        hipCm?: number | null;
                        note?: string | null;
                    };
                };
            };
            responses: {
                /** @description 记录身体指标 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BodyMeasurementEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/fitness/personal-records": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 个人纪录 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 个人纪录 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PersonalRecordsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 创建个人纪录 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        exerciseId?: string | null;
                        /** @enum {string} */
                        recordType: "WEIGHT" | "REPS" | "DURATION" | "DISTANCE" | "SPEED" | "OTHER";
                        value: number;
                        unit: string;
                        /** Format: date-time */
                        achievedAt: string;
                        workoutSessionId?: string | null;
                    };
                };
            };
            responses: {
                /** @description 创建个人纪录 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PersonalRecordEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/fitness/recovery": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 恢复状态 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 恢复状态 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RecoveryRecordsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        /** 记录恢复状态 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: date */
                        recordedDate: string;
                        recoveryLevel: number;
                        sorenessLevel?: number | null;
                        energyLevel?: number | null;
                        note?: string | null;
                    };
                };
            };
            responses: {
                /** @description 记录恢复状态 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RecoveryRecordEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/life/fitness/plans/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 训练计划已删除 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 训练计划已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新训练计划 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name?: string;
                        description?: string | null;
                        goalId?: string | null;
                        /** @enum {string} */
                        status?: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
                        items?: {
                            exerciseId: string;
                            setsTarget: number | null;
                            repsTarget: string | null;
                            weightTarget: number | null;
                            durationSecondsTarget: number | null;
                            distanceTarget: number | null;
                            sortOrder: number;
                        }[];
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 训练计划已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkoutPlanEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/life/fitness/exercises/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 动作已删除 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 动作已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新动作 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name?: string;
                        /** @enum {string} */
                        exerciseType?: "STRENGTH" | "CARDIO" | "MOBILITY" | "SPORT" | "OTHER";
                        muscleGroups?: string[];
                        defaultUnit?: string | null;
                        instructions?: string | null;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 更新动作 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ExerciseEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/life/fitness/sessions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 训练记录已删除 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 训练记录已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新训练记录 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        workoutPlanId?: string | null;
                        taskId?: string | null;
                        /** Format: date-time */
                        startedAt?: string;
                        /** Format: date-time */
                        endedAt?: string;
                        caloriesBurned?: number | null;
                        perceivedEffort?: number | null;
                        note?: string | null;
                        sets?: {
                            exerciseId: string;
                            setNumber: number;
                            reps: number | null;
                            weight: number | null;
                            durationSeconds: number | null;
                            distance: number | null;
                            completed: boolean;
                        }[];
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 更新训练记录 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkoutSessionEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/life/fitness/body-measurements/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 身体指标已删除 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 身体指标已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新身体指标 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: date-time */
                        measuredAt?: string;
                        weightKg?: number | null;
                        bodyFatPercent?: number | null;
                        waistCm?: number | null;
                        chestCm?: number | null;
                        hipCm?: number | null;
                        note?: string | null;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 更新身体指标 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BodyMeasurementEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/life/fitness/personal-records/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 个人纪录已删除 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 个人纪录已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新个人纪录 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        exerciseId?: string | null;
                        /** @enum {string} */
                        recordType?: "WEIGHT" | "REPS" | "DURATION" | "DISTANCE" | "SPEED" | "OTHER";
                        value?: number;
                        unit?: string;
                        /** Format: date-time */
                        achievedAt?: string;
                        workoutSessionId?: string | null;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 更新个人纪录 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PersonalRecordEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/life/fitness/recovery/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** 恢复状态已删除 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 恢复状态已删除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** 更新恢复状态 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: date */
                        recordedDate?: string;
                        recoveryLevel?: number;
                        sorenessLevel?: number | null;
                        energyLevel?: number | null;
                        note?: string | null;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 更新恢复状态 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RecoveryRecordEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/plans/{id}/set-progress": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 切换计划手动或自动进度 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        value: number | null;
                    };
                };
            };
            responses: {
                /** @description 计划进度已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PlanEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/plans/views/kanban": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 计划看板投影 */
        get: {
            parameters: {
                query?: {
                    range?: "TODAY" | "WEEK" | "SHORT_TERM" | "LONG_TERM" | "CUSTOM";
                    from?: string;
                    to?: string;
                    area?: "WORK" | "LIFE";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 计划看板投影 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["KanbanEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/plans/views/calendar": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 计划日历投影 */
        get: {
            parameters: {
                query?: {
                    range?: "TODAY" | "WEEK" | "SHORT_TERM" | "LONG_TERM" | "CUSTOM";
                    from?: string;
                    to?: string;
                    area?: "WORK" | "LIFE";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 计划日历投影 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["CalendarEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/plans/views/timeline": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 计划时间轴投影 */
        get: {
            parameters: {
                query?: {
                    range?: "TODAY" | "WEEK" | "SHORT_TERM" | "LONG_TERM" | "CUSTOM";
                    from?: string;
                    to?: string;
                    area?: "WORK" | "LIFE";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 计划时间轴投影 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PlanTimelineEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/plans/views/goal-tree": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 目标树投影 */
        get: {
            parameters: {
                query?: {
                    range?: "TODAY" | "WEEK" | "SHORT_TERM" | "LONG_TERM" | "CUSTOM";
                    from?: string;
                    to?: string;
                    area?: "WORK" | "LIFE";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 目标树投影 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GoalTreeEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 获取本地系统状态 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 当前系统状态 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SystemStatusEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/diagnostics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 获取脱敏诊断信息
         * @description 返回版本、Schema、数据目录标识、后台任务、磁盘与脱敏后的日志尾部；不包含个人内容与密钥。
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 诊断信息 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DiagnosticInfoEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/system/diagnostics:export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * 导出诊断包
         * @description 将脱敏后的诊断信息与日志打包为 ZIP，存放在数据目录缓存中并返回路径。
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 诊断包路径 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DiagnosticExportEnvelope"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/quick-capture": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 快捷记录 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        text: string;
                        /** @enum {string} */
                        mode: "INBOX_ONLY" | "AI_PROCESS";
                    };
                };
            };
            responses: {
                /** @description 已记录 */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InboxItemEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description AI 不可用 */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inbox": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 收集箱列表 */
        get: {
            parameters: {
                query?: {
                    status?: "UNPROCESSED" | "PROCESSING" | "PROCESSED" | "ARCHIVED";
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 收集箱列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InboxItemsEnvelope"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inbox/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 收集箱详情 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 收集箱详情 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InboxItemEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** 修改收集内容 */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        rawText: string;
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 内容已更新 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InboxItemEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/inbox/{id}:process-manually": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 手动拆分收集内容 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                        results: ({
                            /** @enum {string} */
                            resultType: "TASK";
                            categoryId: string;
                            title: string;
                            /**
                             * @default NORMAL
                             * @enum {string}
                             */
                            priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                            /** Format: date-time */
                            dueAt: string;
                            /** @default 30 */
                            estimatedMinutes?: number;
                            /** @default true */
                            isFlexible?: boolean;
                            /** @enum {string} */
                            preferredArea: "WORK" | "LIFE";
                        } | {
                            /** @enum {string} */
                            resultType: "SHOPPING_ITEM";
                            categoryId: string;
                            name: string;
                            /** @default 1 */
                            quantity?: number;
                            /**
                             * @default NORMAL
                             * @enum {string}
                             */
                            priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                        } | {
                            /** @enum {string} */
                            resultType: "GOAL";
                            categoryId: string;
                            title: string;
                            description?: string;
                            /** @enum {string} */
                            goalType: "OUTCOME" | "HABIT";
                            /** @enum {string} */
                            status?: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
                            /** Format: date */
                            startDate: string;
                            /** Format: date */
                            endDate?: string | null;
                        })[];
                    };
                };
            };
            responses: {
                /** @description 已完成拆分 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InboxItemEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inbox/{id}:process-with-ai": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 使用 AI 处理收集内容 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description AI 不可用 */
                503: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/inbox/{id}:archive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 归档收集内容 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 已归档 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InboxItemEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/drafts/{draftKey}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 读取表单草稿 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    draftKey: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 草稿或空值 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DraftEnvelope"];
                    };
                };
            };
        };
        /** 自动保存表单草稿 */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    draftKey: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        entityId?: string | null;
                        formType: string;
                        content?: unknown;
                        /** Format: date-time */
                        expiresAt?: string | null;
                    };
                };
            };
            responses: {
                /** @description 草稿已保存 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DraftEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        post?: never;
        /** 清除表单草稿 */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    draftKey: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 草稿已清除 */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/work/entities/{entityId}/notes/{noteId}:convert-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 预览笔记模式转换 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    entityId: string;
                    noteId: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        targetMode: "RICH_TEXT" | "MARKDOWN";
                    };
                };
            };
            responses: {
                /** @description 转换预览 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ConvertNotePreviewEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 全局关键词搜索 */
        get: {
            parameters: {
                query: {
                    q: string;
                    entityType?: string;
                    module?: string;
                    categoryId?: string;
                    status?: string;
                    tagId?: string;
                    from?: string;
                    to?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 搜索结果 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SearchResultsEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/search/rebuild": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 重建搜索投影 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 重建完成 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RebuildSearchEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/entities/{id}/versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 对象版本历史 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 版本列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EntityVersionsEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/entities/{id}/versions/{version}:restore-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 恢复指定对象版本预览 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    version: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 确认预览 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ConfirmationPreviewEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/change-sets": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 最近操作 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 变更集列表 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ChangeSetsEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recycle-bin": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 回收站 */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description 软删除对象 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RecycleItemsEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recycle-bin/{id}:restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 恢复软删除对象 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 已恢复 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MutationEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recycle-bin/{id}:purge-preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 永久删除预览 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        expectedVersion: number;
                    };
                };
            };
            responses: {
                /** @description 确认预览 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ConfirmationPreviewEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/confirmations/{id}:execute": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 执行高风险操作 */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        token: string;
                        /** @enum {string} */
                        operation: "PURGE_ENTITY" | "RESTORE_VERSION" | "UNDO_CHANGE_SET" | "REDO_CHANGE_SET";
                        entityId: string;
                        expectedVersion: number;
                        targetVersion?: number;
                        changeSetId?: string;
                    };
                };
            };
            responses: {
                /** @description 执行完成 */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MutationEnvelope"];
                    };
                };
                /** @description 状态或版本冲突 */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
                /** @description 请求校验失败 */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": components["schemas"]["ProblemDetails"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        SystemStatus: {
            /** @enum {string} */
            state: "STARTING" | "READY" | "DEGRADED";
            appVersion: string;
            /** Format: date-time */
            serverTime: string;
            /** @enum {string} */
            timeZone: "Asia/Shanghai";
            database: {
                connected: boolean;
                dataDirectoryConfigured: boolean;
            };
            capabilities: {
                aiConfigured: boolean;
                schedulerAvailable: boolean;
            };
            backgroundJobs: {
                pending: number;
                running: number;
                failed: number;
            };
            disk: {
                freeBytes: number;
                totalBytes: number;
            };
        };
        SystemStatusEnvelope: {
            data: {
                /** @enum {string} */
                state: "STARTING" | "READY" | "DEGRADED";
                appVersion: string;
                /** Format: date-time */
                serverTime: string;
                /** @enum {string} */
                timeZone: "Asia/Shanghai";
                database: {
                    connected: boolean;
                    dataDirectoryConfigured: boolean;
                };
                capabilities: {
                    aiConfigured: boolean;
                    schedulerAvailable: boolean;
                };
                backgroundJobs: {
                    pending: number;
                    running: number;
                    failed: number;
                };
                disk: {
                    freeBytes: number;
                    totalBytes: number;
                };
            };
            meta: {
                requestId: string;
            };
        };
        DiagnosticInfoEnvelope: {
            data: {
                appVersion: string;
                schemaVersion: number;
                dataDirectoryId: string;
                /** Format: date-time */
                generatedAt: string;
                uptimeSeconds: number;
                backgroundJobs: {
                    pending: number;
                    running: number;
                    failed: number;
                };
                disk: {
                    freeBytes: number;
                    totalBytes: number;
                };
                logs: {
                    name: string;
                    bytes: number;
                }[];
                logTail: string;
            };
            meta: {
                requestId: string;
            };
        };
        DiagnosticExportEnvelope: {
            data: {
                path: string;
            };
            meta: {
                requestId: string;
            };
        };
        ProblemDetails: {
            type: string;
            title: string;
            status: number;
            detail: string;
            code: string;
            instance: string;
            requestId: string;
            errors?: {
                path: string;
                code: string;
                message: string;
            }[];
        };
        InboxItemEnvelope: {
            data: {
                id: string;
                rawText: string;
                /** @enum {string} */
                status: "UNPROCESSED" | "PROCESSING" | "PROCESSED" | "ARCHIVED";
                /** @enum {string} */
                captureMode: "INBOX_ONLY" | "AI_PROCESS";
                processedChangeSetId: string | null;
                /** Format: date-time */
                processedAt: string | null;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                results: {
                    entityId: string;
                    /** @enum {string} */
                    resultType: "TASK" | "SHOPPING_ITEM" | "GOAL";
                    /** Format: date-time */
                    createdAt: string;
                }[];
            };
            meta: {
                requestId: string;
            };
        };
        InboxItemsEnvelope: {
            data: {
                id: string;
                rawText: string;
                /** @enum {string} */
                status: "UNPROCESSED" | "PROCESSING" | "PROCESSED" | "ARCHIVED";
                /** @enum {string} */
                captureMode: "INBOX_ONLY" | "AI_PROCESS";
                processedChangeSetId: string | null;
                /** Format: date-time */
                processedAt: string | null;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                results: {
                    entityId: string;
                    /** @enum {string} */
                    resultType: "TASK" | "SHOPPING_ITEM" | "GOAL";
                    /** Format: date-time */
                    createdAt: string;
                }[];
            }[];
            meta: {
                requestId: string;
            };
        };
        DraftEnvelope: {
            data: {
                id: string;
                draftKey: string;
                entityId: string | null;
                formType: string;
                content?: unknown;
                /** Format: date-time */
                updatedAt: string;
                /** Format: date-time */
                expiresAt: string | null;
            } | null;
            meta: {
                requestId: string;
            };
        };
        ConvertNotePreviewEnvelope: {
            data: {
                /** @enum {string} */
                sourceMode: "RICH_TEXT" | "MARKDOWN";
                /** @enum {string} */
                targetMode: "RICH_TEXT" | "MARKDOWN";
                preview: string;
                warnings: string[];
                hasLoss: boolean;
            };
            meta: {
                requestId: string;
            };
        };
        SearchResultsEnvelope: {
            data: {
                entityId: string;
                entityType: string;
                categoryId: string | null;
                ownerEntityId: string | null;
                ownerEntityType: string | null;
                title: string;
                snippet: string;
                /** Format: date-time */
                eventAt: string | null;
                /** Format: date-time */
                updatedAt: string;
            }[];
            meta: {
                requestId: string;
            };
        };
        RebuildSearchEnvelope: {
            data: {
                indexed: number;
            };
            meta: {
                requestId: string;
            };
        };
        EntityVersionsEnvelope: {
            data: {
                entityVersion: number;
                source: string;
                snapshot?: unknown;
                /** Format: date-time */
                createdAt: string;
                changeSetId: string | null;
                summary: string | null;
                /** @enum {string} */
                historyKind: "AUDIT_ONLY" | "BASELINE" | "CANONICAL";
                /** @enum {string} */
                restoreEligibility: "UNVERIFIED" | "ELIGIBLE";
            }[];
            meta: {
                requestId: string;
            };
        };
        ChangeSetsEnvelope: {
            data: {
                id: string;
                source: string;
                summary: string;
                riskLevel: string;
                status: string;
                operationCount: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                appliedAt: string | null;
                /** Format: date-time */
                revertedAt: string | null;
                entityId: string | null;
                entityVersion: number | null;
                canUndo: boolean;
                canRedo: boolean;
            }[];
            meta: {
                requestId: string;
            };
        };
        RecycleItemsEnvelope: {
            data: {
                id: string;
                entityType: string;
                version: number;
                title: string;
                /** Format: date-time */
                deletedAt: string;
                /** Format: date-time */
                purgeAfter: string;
            }[];
            meta: {
                requestId: string;
            };
        };
        ConfirmationPreviewEnvelope: {
            data: {
                id: string;
                token: string;
                /** Format: date-time */
                expiresAt: string;
                preview?: unknown;
            };
            meta: {
                requestId: string;
            };
        };
        MutationEnvelope: {
            data: {
                /** @enum {boolean} */
                success: true;
            };
            meta: {
                requestId: string;
            };
        };
        AiProviderEnvelope: {
            data: {
                id: string;
                /** @enum {string} */
                providerType: "OPENAI" | "ANTHROPIC" | "GOOGLE" | "OPENAI_COMPATIBLE";
                displayName: string;
                /** Format: uri */
                baseUrl: string | null;
                modelId: string;
                hasCredential: boolean;
                capabilities: {
                    chat: boolean;
                    streaming: boolean;
                    toolCalling: boolean;
                    nativeWebSearch: boolean;
                };
                isDefault: boolean;
                /** Format: date-time */
                lastVerifiedAt: string | null;
                lastError: string | null;
                version: number;
            };
            meta: {
                requestId: string;
            };
        };
        AiProviderConfigsEnvelope: {
            data: {
                id: string;
                /** @enum {string} */
                providerType: "OPENAI" | "ANTHROPIC" | "GOOGLE" | "OPENAI_COMPATIBLE";
                displayName: string;
                /** Format: uri */
                baseUrl: string | null;
                modelId: string;
                hasCredential: boolean;
                capabilities: {
                    chat: boolean;
                    streaming: boolean;
                    toolCalling: boolean;
                    nativeWebSearch: boolean;
                };
                isDefault: boolean;
                /** Format: date-time */
                lastVerifiedAt: string | null;
                lastError: string | null;
                version: number;
            }[];
            meta: {
                requestId: string;
            };
        };
        ChatSessionEnvelope: {
            data: {
                id: string;
                title: string;
                providerConfigId: string;
                /** @enum {string} */
                status: "ACTIVE" | "ARCHIVED";
                /** Format: date-time */
                lastMessageAt: string | null;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
            };
            meta: {
                requestId: string;
            };
        };
        ChatSessionsEnvelope: {
            data: {
                id: string;
                title: string;
                providerConfigId: string;
                /** @enum {string} */
                status: "ACTIVE" | "ARCHIVED";
                /** Format: date-time */
                lastMessageAt: string | null;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
            }[];
            meta: {
                requestId: string;
            };
        };
        ChatMessagesEnvelope: {
            data: {
                id: string;
                /** @enum {string} */
                role: "USER" | "ASSISTANT" | "TOOL" | "SYSTEM";
                content?: unknown;
                plainText: string;
                modelId: string | null;
                /** @enum {string} */
                status: "PENDING" | "STREAMING" | "COMPLETED" | "FAILED" | "CANCELLED";
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                completedAt: string | null;
                sources: {
                    title: string;
                    /** Format: uri */
                    url: string;
                    /** Format: date-time */
                    retrievedAt: string;
                }[];
            }[];
            meta: {
                requestId: string;
            };
        };
        AiRunEnvelope: {
            data: {
                id: string;
                sessionId: string;
                /** @enum {string} */
                status: "QUEUED" | "RUNNING" | "AWAITING_TOOL" | "AWAITING_CONFIRMATION" | "COMPLETED" | "FAILED" | "CANCELLED";
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                startedAt: string | null;
                /** Format: date-time */
                finishedAt: string | null;
                errorCode: string | null;
            };
            meta: {
                requestId: string;
            };
        };
        AiChangeSetEnvelope: {
            data: {
                id: string;
                /** @enum {string} */
                source: "USER" | "RULE_ENGINE" | "AI" | "SYSTEM";
                summary: string;
                /** @enum {string} */
                riskLevel: "READ_ONLY" | "LOW_WRITE" | "HIGH_WRITE";
                /** @enum {string} */
                status: "PENDING" | "APPLIED" | "REVERTED" | "FAILED";
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                appliedAt: string | null;
                /** Format: date-time */
                revertedAt: string | null;
                operations: {
                    sequence: number;
                    entityId: string | null;
                    /** @enum {string} */
                    operation: "CREATE" | "UPDATE" | "SOFT_DELETE" | "RESTORE" | "PURGE";
                    before?: unknown;
                    after?: unknown;
                }[];
            };
            meta: {
                requestId: string;
            };
        };
        SendChatMessageEnvelope: {
            data: {
                userMessageId: string;
                assistantMessageId: string;
                runId: string;
                /** @enum {string} */
                status: "QUEUED";
            };
            meta: {
                requestId: string;
            };
        };
        NotificationsEnvelope: {
            data: {
                id: string;
                /** @enum {string} */
                notificationType: "REMINDER" | "SYSTEM" | "AI_SUGGESTION" | "SCHEDULE_WARNING";
                targetEntityId: string | null;
                targetEntityType: string | null;
                title: string;
                body: string;
                /** @enum {string} */
                severity: "INFO" | "WARNING" | "CRITICAL";
                /** Format: date-time */
                scheduledAt: string;
                /** Format: date-time */
                deliveredAt: string | null;
                /** Format: date-time */
                readAt: string | null;
                /** Format: date-time */
                snoozedUntil: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        ClearAiMemoryPreviewEnvelope: {
            data: {
                confirmationId: string;
                count: number;
                /** Format: date-time */
                expiresAt: string;
            };
            meta: {
                requestId: string;
            };
        };
        ClearAiMemoryConfirmEnvelope: {
            data: {
                cleared: number;
            };
            meta: {
                requestId: string;
            };
        };
        ReminderEnvelope: {
            data: {
                id: string;
                targetEntityId: string;
                /** @enum {string} */
                targetEntityType: "TASK" | "EVENT";
                /** @enum {string} */
                triggerMode: "ABSOLUTE" | "OFFSET_BEFORE_START" | "OFFSET_BEFORE_DUE";
                /** Format: date-time */
                triggerAt: string | null;
                offsetMinutes: number | null;
                isEnabled: boolean;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
            };
            meta: {
                requestId: string;
            };
        };
        RemindersEnvelope: {
            data: {
                id: string;
                targetEntityId: string;
                /** @enum {string} */
                targetEntityType: "TASK" | "EVENT";
                /** @enum {string} */
                triggerMode: "ABSOLUTE" | "OFFSET_BEFORE_START" | "OFFSET_BEFORE_DUE";
                /** Format: date-time */
                triggerAt: string | null;
                offsetMinutes: number | null;
                isEnabled: boolean;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
            }[];
            meta: {
                requestId: string;
            };
        };
        HolidayUpdateResultEnvelope: {
            data: {
                providerId: string;
                year: number;
                applied: number;
                preservedUserOverrides: number;
            };
            meta: {
                requestId: string;
            };
        };
        HolidayOverrideRemoveEnvelope: {
            data: {
                removed: boolean;
            };
            meta: {
                requestId: string;
            };
        };
        SetupStatusEnvelope: {
            data: {
                initialized: boolean;
                dataDirectory: string | null;
                suggestedDataDirectory: string;
            };
            meta: {
                requestId: string;
            };
        };
        SettingsEnvelope: {
            data: {
                key: string;
                value: string | number | boolean | unknown[] | {
                    [key: string]: unknown;
                };
                /** @enum {string} */
                valueType: "STRING" | "NUMBER" | "BOOLEAN" | "OBJECT" | "ARRAY";
                /** Format: date-time */
                updatedAt: string;
            }[];
            meta: {
                requestId: string;
            };
        };
        SettingsSchemaEnvelope: {
            data: {
                key: string;
                label: string;
                /** @enum {string} */
                type: "STRING" | "NUMBER" | "BOOLEAN" | "SELECT" | "PATH";
                options?: {
                    value: string | number | boolean | unknown[] | {
                        [key: string]: unknown;
                    };
                    label: string;
                }[];
                minimum?: number;
                maximum?: number;
                /** @enum {boolean} */
                sensitive: false;
            }[];
            meta: {
                requestId: string;
            };
        };
        CategoriesEnvelope: {
            data: {
                id: string;
                /** @enum {string} */
                parentArea: "WORK" | "LIFE";
                /** @enum {string} */
                moduleType: "SELF_MEDIA" | "DEVELOPMENT" | "LEARNING" | "SHOPPING" | "DIET" | "FITNESS" | "ENTERTAINMENT" | "GENERIC";
                name: string;
                description: string | null;
                sortOrder: number;
                isArchived: boolean;
                version: number;
            }[];
            meta: {
                requestId: string;
                orderVersions: {
                    WORK?: number;
                    LIFE?: number;
                };
            };
        };
        CategoryEnvelope: {
            data: {
                id: string;
                /** @enum {string} */
                parentArea: "WORK" | "LIFE";
                /** @enum {string} */
                moduleType: "SELF_MEDIA" | "DEVELOPMENT" | "LEARNING" | "SHOPPING" | "DIET" | "FITNESS" | "ENTERTAINMENT" | "GENERIC";
                name: string;
                description: string | null;
                sortOrder: number;
                isArchived: boolean;
                version: number;
            };
            meta: {
                requestId: string;
            };
        };
        TagsEnvelope: {
            data: {
                id: string;
                name: string;
                colorToken: string | null;
                description: string | null;
                version: number;
            }[];
            meta: {
                requestId: string;
            };
        };
        TagEnvelope: {
            data: {
                id: string;
                name: string;
                colorToken: string | null;
                description: string | null;
                version: number;
            };
            meta: {
                requestId: string;
            };
        };
        SessionEnvelope: {
            data: {
                csrfToken: string;
                /** Format: date-time */
                expiresAt: string;
            };
            meta: {
                requestId: string;
            };
        };
        BackupEnvelope: {
            data: {
                path: string;
                checksum: string;
                manifest: {
                    /** @enum {number} */
                    formatVersion: 1;
                    appVersion: string;
                    schemaVersion: number;
                    /** Format: date-time */
                    generatedAt: string;
                    installationId: string;
                    fileCount: number;
                };
            };
            meta: {
                requestId: string;
            };
        };
        BackupRecordsEnvelope: {
            data: {
                id: string;
                backupType: string;
                status: string;
                path: string | null;
                manifest?: unknown;
                checksum: string | null;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                finishedAt: string | null;
                error: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        BackupRestorePreviewEnvelope: {
            data: {
                path: string;
                appVersion: string;
                schemaVersion: number;
                /** Format: date-time */
                generatedAt: string;
                fileCount: number;
                confirmation: {
                    id: string;
                    token: string;
                    /** Format: date-time */
                    expiresAt: string;
                };
            };
            meta: {
                requestId: string;
            };
        };
        DemoDataStatusEnvelope: {
            data: {
                exists: boolean;
                recordCount: number;
                batchId: string;
            };
            meta: {
                requestId: string;
            };
        };
        DemoDataClearPreviewEnvelope: {
            data: {
                exists: boolean;
                recordCount: number;
                batchId: string;
                confirmation: {
                    id: string;
                    token: string;
                    /** Format: date-time */
                    expiresAt: string;
                };
            };
            meta: {
                requestId: string;
            };
        };
        AttachmentEnvelope: {
            data: {
                id: string;
                originalName: string;
                safeName: string;
                mediaType: string;
                extension: string | null;
                sizeBytes: number;
                sha256: string;
                storageKey: string;
                description: string | null;
                /** @enum {string} */
                status: "UPLOADING" | "READY" | "MISSING" | "QUARANTINED";
            };
            meta: {
                requestId: string;
            };
        };
        DataDirectoryMigrationPreviewEnvelope: {
            data: {
                source: string;
                destination: string;
                fileCount: number;
                totalBytes: number;
                confirmation: {
                    id: string;
                    token: string;
                    /** Format: date-time */
                    expiresAt: string;
                };
            };
            meta: {
                requestId: string;
            };
        };
        DeleteTagPreviewEnvelope: {
            data: {
                summary: string;
                tagId: string;
                confirmation: {
                    id: string;
                    token: string;
                    /** Format: date-time */
                    expiresAt: string;
                };
            };
            meta: {
                requestId: string;
            };
        };
        GoalsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                title: string;
                description: string | null;
                /** @enum {string} */
                goalType: "OUTCOME" | "HABIT";
                /** @enum {string} */
                status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
                /** Format: date */
                startDate: string;
                /** Format: date */
                endDate: string | null;
                /** @enum {string} */
                horizon: "SHORT_TERM" | "LONG_TERM";
                autoProgress: number;
                manualProgress: number | null;
                /** @enum {string} */
                progressMode: "AUTO" | "MANUAL_OVERRIDE";
                displayProgress: number;
            }[];
            meta: {
                requestId: string;
            };
        };
        GoalEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                title: string;
                description: string | null;
                /** @enum {string} */
                goalType: "OUTCOME" | "HABIT";
                /** @enum {string} */
                status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
                /** Format: date */
                startDate: string;
                /** Format: date */
                endDate: string | null;
                /** @enum {string} */
                horizon: "SHORT_TERM" | "LONG_TERM";
                autoProgress: number;
                manualProgress: number | null;
                /** @enum {string} */
                progressMode: "AUTO" | "MANUAL_OVERRIDE";
                displayProgress: number;
            };
            meta: {
                requestId: string;
            };
        };
        GoalMetricsStateEnvelope: {
            data: {
                goalId: string;
                goalVersion: number;
                autoProgress: number;
                displayProgress: number;
                /** @enum {string} */
                progressMode: "AUTO" | "MANUAL_OVERRIDE";
                metrics: {
                    id: string;
                    goalId: string;
                    name: string;
                    /** @enum {string} */
                    metricType: "NUMBER" | "COUNT" | "DURATION" | "PERCENTAGE" | "BOOLEAN";
                    unit: string | null;
                    startValue: number | null;
                    targetValue: number;
                    /** @enum {string} */
                    direction: "INCREASE" | "DECREASE" | "MAINTAIN";
                    weight: number;
                    latestValue: number | null;
                    /** Format: date-time */
                    latestRecordedAt: string | null;
                    progressPercent: number;
                }[];
                entries: {
                    id: string;
                    goalId: string;
                    metricId: string | null;
                    value: number;
                    /** Format: date-time */
                    recordedAt: string;
                    /** @enum {string} */
                    source: "USER" | "TASKS" | "HEALTH" | "SYSTEM" | "AI";
                    sourceEntityId: string | null;
                    note: string | null;
                }[];
            };
            meta: {
                requestId: string;
            };
        };
        PlansEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                goalId: string | null;
                categoryId: string;
                title: string;
                description: string | null;
                /** @enum {string} */
                status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
                /** @enum {string} */
                priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                /** Format: date */
                startDate: string;
                /** Format: date */
                endDate: string;
                autoProgress: number;
                manualProgress: number | null;
                /** @enum {string} */
                progressMode: "AUTO" | "MANUAL_OVERRIDE";
                displayProgress: number;
            }[];
            meta: {
                requestId: string;
            };
        };
        PlanEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                goalId: string | null;
                categoryId: string;
                title: string;
                description: string | null;
                /** @enum {string} */
                status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
                /** @enum {string} */
                priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                /** Format: date */
                startDate: string;
                /** Format: date */
                endDate: string;
                autoProgress: number;
                manualProgress: number | null;
                /** @enum {string} */
                progressMode: "AUTO" | "MANUAL_OVERRIDE";
                displayProgress: number;
            };
            meta: {
                requestId: string;
            };
        };
        PlanMilestoneEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                planId: string;
                title: string;
                description: string | null;
                /** Format: date-time */
                dueAt: string;
                /** @enum {string} */
                status: "PENDING" | "AT_RISK" | "ACHIEVED" | "MISSED";
                /** Format: date-time */
                achievedAt: string | null;
                linkedEntityIds: string[];
            };
            meta: {
                requestId: string;
            };
        };
        PlanMilestonesEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                planId: string;
                title: string;
                description: string | null;
                /** Format: date-time */
                dueAt: string;
                /** @enum {string} */
                status: "PENDING" | "AT_RISK" | "ACHIEVED" | "MISSED";
                /** Format: date-time */
                achievedAt: string | null;
                linkedEntityIds: string[];
            }[];
            meta: {
                requestId: string;
            };
        };
        TasksEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                planId: string | null;
                goalId: string | null;
                parentTaskId: string | null;
                title: string;
                description: string | null;
                /** @enum {string} */
                status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
                /** @enum {string} */
                priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                /** Format: date-time */
                dueAt: string;
                estimatedMinutes: number;
                isFlexible: boolean;
                isSplittable: boolean;
                /** @enum {string} */
                preferredArea: "WORK" | "LIFE";
                /** Format: date-time */
                completedAt: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        TaskEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                planId: string | null;
                goalId: string | null;
                parentTaskId: string | null;
                title: string;
                description: string | null;
                /** @enum {string} */
                status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
                /** @enum {string} */
                priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                /** Format: date-time */
                dueAt: string;
                estimatedMinutes: number;
                isFlexible: boolean;
                isSplittable: boolean;
                /** @enum {string} */
                preferredArea: "WORK" | "LIFE";
                /** Format: date-time */
                completedAt: string | null;
            };
            meta: {
                requestId: string;
            };
        };
        EventsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                title: string;
                description: string | null;
                /** Format: date-time */
                startAt: string;
                /** Format: date-time */
                endAt: string;
                timeZone: string;
                /** @enum {string} */
                eventType: "GENERAL" | "MEETING" | "MEDICAL" | "TRAVEL" | "REST";
                /** @enum {string} */
                priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                isImmovable: boolean;
                allowOverlap: boolean;
                /** @enum {string} */
                status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
            }[];
            meta: {
                requestId: string;
            };
        };
        EventEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                title: string;
                description: string | null;
                /** Format: date-time */
                startAt: string;
                /** Format: date-time */
                endAt: string;
                timeZone: string;
                /** @enum {string} */
                eventType: "GENERAL" | "MEETING" | "MEDICAL" | "TRAVEL" | "REST";
                /** @enum {string} */
                priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                isImmovable: boolean;
                allowOverlap: boolean;
                /** @enum {string} */
                status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
            };
            meta: {
                requestId: string;
            };
        };
        RoutineTemplatesEnvelope: {
            data: {
                id: string;
                version: number;
                name: string;
                /** @enum {string} */
                templateType: "WORKDAY" | "WEEKEND" | "HOLIDAY" | "CUSTOM";
                isDefault: boolean;
                timeZone: string;
                segments: {
                    id: string;
                    name: string;
                    /** @enum {string} */
                    segmentType: "SLEEP" | "WORK" | "LIFE" | "REST";
                    startTime: string;
                    endTime: string;
                    isImmovable: boolean;
                    sortOrder: number;
                }[];
            }[];
            meta: {
                requestId: string;
            };
        };
        RoutineTemplateEnvelope: {
            data: {
                id: string;
                version: number;
                name: string;
                /** @enum {string} */
                templateType: "WORKDAY" | "WEEKEND" | "HOLIDAY" | "CUSTOM";
                isDefault: boolean;
                timeZone: string;
                segments: {
                    id: string;
                    name: string;
                    /** @enum {string} */
                    segmentType: "SLEEP" | "WORK" | "LIFE" | "REST";
                    startTime: string;
                    endTime: string;
                    isImmovable: boolean;
                    sortOrder: number;
                }[];
            };
            meta: {
                requestId: string;
            };
        };
        HolidaysEnvelope: {
            data: {
                /** Format: date */
                localDate: string;
                name: string;
                /** @enum {string} */
                dayType: "HOLIDAY" | "MAKEUP_WORKDAY";
                /** @enum {string} */
                source: "SYSTEM_UPDATE" | "USER_OVERRIDE";
            }[];
            meta: {
                requestId: string;
            };
        };
        RecurrenceRuleEnvelope: {
            data: {
                id: string;
                version: number;
                /** @enum {string} */
                targetType: "TASK_TEMPLATE" | "EVENT_TEMPLATE";
                targetEntityId: string;
                rrule: string;
                dtstartLocal: string;
                timeZone: string;
                /** Format: date-time */
                untilAt: string | null;
                countLimit: number | null;
                generationHorizonDays: number;
                isActive: boolean;
            };
            meta: {
                requestId: string;
            };
        };
        NullableRecurrenceRuleEnvelope: {
            data: {
                id: string;
                version: number;
                /** @enum {string} */
                targetType: "TASK_TEMPLATE" | "EVENT_TEMPLATE";
                targetEntityId: string;
                rrule: string;
                dtstartLocal: string;
                timeZone: string;
                /** Format: date-time */
                untilAt: string | null;
                countLimit: number | null;
                generationHorizonDays: number;
                isActive: boolean;
            } | null;
            meta: {
                requestId: string;
            };
        };
        RecurrenceOccurrencesEnvelope: {
            data: {
                id: string;
                ruleId: string;
                recurrenceKey: string;
                /** Format: date-time */
                scheduledAt: string;
                generatedEntityId: string | null;
                /** @enum {string} */
                status: "GENERATED" | "SKIPPED" | "CANCELLED";
            }[];
            meta: {
                requestId: string;
            };
        };
        TimelineEnvelope: {
            data: {
                id: string;
                targetEntityId: string | null;
                title: string;
                /** @enum {string} */
                blockType: "TASK" | "EVENT" | "SLEEP" | "REST";
                /** @enum {string} */
                area: "WORK" | "LIFE" | "SLEEP";
                /** Format: date-time */
                startAt: string;
                /** Format: date-time */
                endAt: string;
                /** @enum {string} */
                source: "MANUAL" | "RULE_ENGINE" | "ROUTINE";
                isLocked: boolean;
                crossAreaWarning: boolean;
            }[];
            meta: {
                requestId: string;
            };
        };
        ScheduleRunEnvelope: {
            data: {
                id: string;
                /** @enum {string} */
                status: "APPLIED" | "NO_CHANGE";
                createdBlocks: number;
                preservedBlocks: number;
                warnings: {
                    entityId: string;
                    /** @enum {string} */
                    warningType: "UNSCHEDULED" | "CROSS_AREA" | "DEPENDENCY_BLOCKED" | "DEADLINE_RISK";
                    /** @enum {string} */
                    severity: "INFO" | "WARNING" | "CRITICAL";
                    message: string;
                }[];
                inputHash: string;
            };
            meta: {
                requestId: string;
            };
        };
        ScheduleWarningsEnvelope: {
            data: {
                id: string;
                entityId: string | null;
                warningType: string;
                severity: string;
                message: string;
            }[];
            meta: {
                requestId: string;
            };
        };
        ScheduleRunDetailEnvelope: {
            data: {
                id: string;
                /** Format: date-time */
                rangeStart: string;
                /** Format: date-time */
                rangeEnd: string;
                trigger: string;
                status: string;
                ruleVersion: string;
                /** Format: date-time */
                createdAt: string;
                summary: {
                    createdBlocks: number;
                    releasedBlocks: {
                        taskId: string;
                        startAt: number;
                        endAt: number;
                    }[];
                    affectedTaskIds: string[];
                    rescheduledTaskIds: string[];
                    unscheduledTaskIds: string[];
                };
                createdBlocks: {
                    id: string;
                    taskId: string;
                    /** Format: date-time */
                    startAt: string;
                    /** Format: date-time */
                    endAt: string;
                    reasonCode: string | null;
                    outcome: string | null;
                    released: boolean;
                    previousBlocks: {
                        /** Format: date-time */
                        startAt: string;
                        /** Format: date-time */
                        endAt: string;
                    }[];
                }[];
                releasedBlocks: {
                    taskId: string;
                    /** Format: date-time */
                    startAt: string;
                    /** Format: date-time */
                    endAt: string;
                }[];
                warnings: {
                    entityId: string | null;
                    warningType: string;
                    severity: string;
                    message: string;
                }[];
            };
            meta: {
                requestId: string;
            };
        };
        TaskScheduleHistoryEnvelope: {
            data: {
                taskId: string;
                entries: {
                    runId: string | null;
                    trigger: string;
                    /** Format: date-time */
                    occurredAt: string;
                    /** @enum {string} */
                    kind: "RELEASED" | "SCHEDULED" | "RESCHEDULED" | "UNSCHEDULED";
                    reason: string | null;
                    previousBlocks: {
                        /** Format: date-time */
                        startAt: string;
                        /** Format: date-time */
                        endAt: string;
                    }[];
                    newBlocks: {
                        /** Format: date-time */
                        startAt: string;
                        /** Format: date-time */
                        endAt: string;
                    }[];
                    warnings: {
                        type: string;
                        severity: string;
                        message: string;
                    }[];
                }[];
            };
            meta: {
                requestId: string;
            };
        };
        TodayEnvelope: {
            data: {
                /** Format: date */
                date: string;
                /** @enum {string} */
                timeZone: "Asia/Shanghai";
                /** Format: date-time */
                serverNow: string;
                timelineVersion: number;
                blocks: {
                    id: string;
                    targetEntityId: string | null;
                    title: string;
                    /** @enum {string} */
                    blockType: "TASK" | "EVENT" | "SLEEP" | "REST";
                    /** @enum {string} */
                    area: "WORK" | "LIFE" | "SLEEP";
                    /** Format: date-time */
                    startAt: string;
                    /** Format: date-time */
                    endAt: string;
                    /** @enum {string} */
                    source: "MANUAL" | "RULE_ENGINE" | "ROUTINE";
                    isLocked: boolean;
                    crossAreaWarning: boolean;
                }[];
                plan: {
                    id: string;
                    entityId: string | null;
                    title: string;
                    /** @enum {string} */
                    kind: "TASK" | "EVENT";
                    /** @enum {string} */
                    area: "WORK" | "LIFE";
                    /** Format: date-time */
                    startAt: string;
                    /** Format: date-time */
                    endAt: string;
                    /** @enum {string} */
                    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                }[];
                freeTime: {
                    /** Format: date-time */
                    startAt: string;
                    /** Format: date-time */
                    endAt: string;
                    minutes: number;
                }[];
                totals: {
                    sleepMinutes: number;
                    workMinutes: number;
                    lifeMinutes: number;
                    freeMinutes: number;
                };
                pressure: {
                    score: number;
                    /** @enum {string} */
                    level: "RELAXED" | "COMFORTABLE" | "ELEVATED" | "HIGH_PRESSURE";
                    /** @enum {string} */
                    algorithmVersion: "pressure-v1";
                    factors: {
                        code: string;
                        points: number;
                        message: string;
                    }[];
                };
                notifications: unknown[];
                suggestions: unknown[];
            };
            meta: {
                requestId: string;
            };
        };
        TodayPlanEnvelope: {
            data: {
                id: string;
                entityId: string | null;
                title: string;
                /** @enum {string} */
                kind: "TASK" | "EVENT";
                /** @enum {string} */
                area: "WORK" | "LIFE";
                /** Format: date-time */
                startAt: string;
                /** Format: date-time */
                endAt: string;
                /** @enum {string} */
                priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
            }[];
            meta: {
                requestId: string;
            };
        };
        TodayTotalsEnvelope: {
            data: {
                sleepMinutes: number;
                workMinutes: number;
                lifeMinutes: number;
                freeMinutes: number;
            };
            meta: {
                requestId: string;
            };
        };
        PressureEnvelope: {
            data: {
                score: number;
                /** @enum {string} */
                level: "RELAXED" | "COMFORTABLE" | "ELEVATED" | "HIGH_PRESSURE";
                /** @enum {string} */
                algorithmVersion: "pressure-v1";
                factors: {
                    code: string;
                    points: number;
                    message: string;
                }[];
            };
            meta: {
                requestId: string;
            };
        };
        KanbanEnvelope: {
            data: {
                /** @enum {string} */
                status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
                plans: {
                    id: string;
                    version: number;
                    /** Format: date-time */
                    createdAt: string;
                    /** Format: date-time */
                    updatedAt: string;
                    goalId: string | null;
                    categoryId: string;
                    title: string;
                    description: string | null;
                    /** @enum {string} */
                    status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
                    /** @enum {string} */
                    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                    /** Format: date */
                    startDate: string;
                    /** Format: date */
                    endDate: string;
                    autoProgress: number;
                    manualProgress: number | null;
                    /** @enum {string} */
                    progressMode: "AUTO" | "MANUAL_OVERRIDE";
                    displayProgress: number;
                }[];
            }[];
            meta: {
                requestId: string;
            };
        };
        CalendarEnvelope: {
            data: {
                /** Format: date */
                date: string;
                plans: {
                    id: string;
                    version: number;
                    /** Format: date-time */
                    createdAt: string;
                    /** Format: date-time */
                    updatedAt: string;
                    goalId: string | null;
                    categoryId: string;
                    title: string;
                    description: string | null;
                    /** @enum {string} */
                    status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
                    /** @enum {string} */
                    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                    /** Format: date */
                    startDate: string;
                    /** Format: date */
                    endDate: string;
                    autoProgress: number;
                    manualProgress: number | null;
                    /** @enum {string} */
                    progressMode: "AUTO" | "MANUAL_OVERRIDE";
                    displayProgress: number;
                }[];
                tasks: {
                    id: string;
                    version: number;
                    /** Format: date-time */
                    createdAt: string;
                    /** Format: date-time */
                    updatedAt: string;
                    categoryId: string;
                    planId: string | null;
                    goalId: string | null;
                    parentTaskId: string | null;
                    title: string;
                    description: string | null;
                    /** @enum {string} */
                    status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
                    /** @enum {string} */
                    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                    /** Format: date-time */
                    dueAt: string;
                    estimatedMinutes: number;
                    isFlexible: boolean;
                    isSplittable: boolean;
                    /** @enum {string} */
                    preferredArea: "WORK" | "LIFE";
                    /** Format: date-time */
                    completedAt: string | null;
                }[];
            }[];
            meta: {
                requestId: string;
            };
        };
        FreeTimeEnvelope: {
            data: {
                /** Format: date-time */
                startAt: string;
                /** Format: date-time */
                endAt: string;
                minutes: number;
            }[];
            meta: {
                requestId: string;
            };
        };
        PlanTimelineEnvelope: {
            data: {
                goal: {
                    id: string;
                    version: number;
                    /** Format: date-time */
                    createdAt: string;
                    /** Format: date-time */
                    updatedAt: string;
                    categoryId: string;
                    title: string;
                    description: string | null;
                    /** @enum {string} */
                    goalType: "OUTCOME" | "HABIT";
                    /** @enum {string} */
                    status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
                    /** Format: date */
                    startDate: string;
                    /** Format: date */
                    endDate: string | null;
                    /** @enum {string} */
                    horizon: "SHORT_TERM" | "LONG_TERM";
                    autoProgress: number;
                    manualProgress: number | null;
                    /** @enum {string} */
                    progressMode: "AUTO" | "MANUAL_OVERRIDE";
                    displayProgress: number;
                } | null;
                plan: {
                    id: string;
                    version: number;
                    /** Format: date-time */
                    createdAt: string;
                    /** Format: date-time */
                    updatedAt: string;
                    goalId: string | null;
                    categoryId: string;
                    title: string;
                    description: string | null;
                    /** @enum {string} */
                    status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
                    /** @enum {string} */
                    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                    /** Format: date */
                    startDate: string;
                    /** Format: date */
                    endDate: string;
                    autoProgress: number;
                    manualProgress: number | null;
                    /** @enum {string} */
                    progressMode: "AUTO" | "MANUAL_OVERRIDE";
                    displayProgress: number;
                };
            }[];
            meta: {
                requestId: string;
            };
        };
        GoalTreeEnvelope: {
            data: {
                goal: {
                    id: string;
                    version: number;
                    /** Format: date-time */
                    createdAt: string;
                    /** Format: date-time */
                    updatedAt: string;
                    categoryId: string;
                    title: string;
                    description: string | null;
                    /** @enum {string} */
                    goalType: "OUTCOME" | "HABIT";
                    /** @enum {string} */
                    status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
                    /** Format: date */
                    startDate: string;
                    /** Format: date */
                    endDate: string | null;
                    /** @enum {string} */
                    horizon: "SHORT_TERM" | "LONG_TERM";
                    autoProgress: number;
                    manualProgress: number | null;
                    /** @enum {string} */
                    progressMode: "AUTO" | "MANUAL_OVERRIDE";
                    displayProgress: number;
                };
                plans: {
                    plan: {
                        id: string;
                        version: number;
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        updatedAt: string;
                        goalId: string | null;
                        categoryId: string;
                        title: string;
                        description: string | null;
                        /** @enum {string} */
                        status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
                        /** @enum {string} */
                        priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                        /** Format: date */
                        startDate: string;
                        /** Format: date */
                        endDate: string;
                        autoProgress: number;
                        manualProgress: number | null;
                        /** @enum {string} */
                        progressMode: "AUTO" | "MANUAL_OVERRIDE";
                        displayProgress: number;
                    };
                    tasks: {
                        id: string;
                        version: number;
                        /** Format: date-time */
                        createdAt: string;
                        /** Format: date-time */
                        updatedAt: string;
                        categoryId: string;
                        planId: string | null;
                        goalId: string | null;
                        parentTaskId: string | null;
                        title: string;
                        description: string | null;
                        /** @enum {string} */
                        status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
                        /** @enum {string} */
                        priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                        /** Format: date-time */
                        dueAt: string;
                        estimatedMinutes: number;
                        isFlexible: boolean;
                        isSplittable: boolean;
                        /** @enum {string} */
                        preferredArea: "WORK" | "LIFE";
                        /** Format: date-time */
                        completedAt: string | null;
                    }[];
                }[];
                directTasks: {
                    id: string;
                    version: number;
                    /** Format: date-time */
                    createdAt: string;
                    /** Format: date-time */
                    updatedAt: string;
                    categoryId: string;
                    planId: string | null;
                    goalId: string | null;
                    parentTaskId: string | null;
                    title: string;
                    description: string | null;
                    /** @enum {string} */
                    status: "TODO" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
                    /** @enum {string} */
                    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                    /** Format: date-time */
                    dueAt: string;
                    estimatedMinutes: number;
                    isFlexible: boolean;
                    isSplittable: boolean;
                    /** @enum {string} */
                    preferredArea: "WORK" | "LIFE";
                    /** Format: date-time */
                    completedAt: string | null;
                }[];
            }[];
            meta: {
                requestId: string;
            };
        };
        WorkOverviewEnvelope: {
            data: {
                range: {
                    /** Format: date */
                    from: string;
                    /** Format: date */
                    to: string;
                };
                tasks: {
                    total: number;
                    completed: number;
                    overdue: number;
                    completionRate: number;
                };
                selfMedia: {
                    contents: number;
                    published: number;
                    views: number;
                };
                development: {
                    projects: number;
                    featureCompletionRate: number;
                    openDefects: number;
                    criticalDefects: number;
                };
                learning: {
                    minutes: number;
                    activeResources: number;
                    completedResources: number;
                };
            };
            meta: {
                requestId: string;
            };
        };
        SelfMediaContentsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                title: string;
                idea: string | null;
                script: string | null;
                /** @enum {string} */
                contentType: "VIDEO" | "ARTICLE" | "AUDIO" | "IMAGE" | "OTHER";
                platform: string | null;
                /** @enum {string} */
                productionStatus: "IDEA" | "PLANNING" | "CREATING" | "READY" | "PUBLISHED" | "ARCHIVED";
                /** Format: date-time */
                plannedPublishAt: string | null;
                /** Format: date-time */
                publishedAt: string | null;
                calendarEventId: string | null;
                taskId: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        SelfMediaContentEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                title: string;
                idea: string | null;
                script: string | null;
                /** @enum {string} */
                contentType: "VIDEO" | "ARTICLE" | "AUDIO" | "IMAGE" | "OTHER";
                platform: string | null;
                /** @enum {string} */
                productionStatus: "IDEA" | "PLANNING" | "CREATING" | "READY" | "PUBLISHED" | "ARCHIVED";
                /** Format: date-time */
                plannedPublishAt: string | null;
                /** Format: date-time */
                publishedAt: string | null;
                calendarEventId: string | null;
                taskId: string | null;
            };
            meta: {
                requestId: string;
            };
        };
        SelfMediaMetricsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                contentId: string;
                /** Format: date */
                recordedDate: string;
                platform: string;
                views: number | null;
                likes: number | null;
                comments: number | null;
                favorites: number | null;
                shares: number | null;
                followerDelta: number | null;
                customMetrics: {
                    [key: string]: number;
                };
            }[];
            meta: {
                requestId: string;
            };
        };
        SelfMediaMetricEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                contentId: string;
                /** Format: date */
                recordedDate: string;
                platform: string;
                views: number | null;
                likes: number | null;
                comments: number | null;
                favorites: number | null;
                shares: number | null;
                followerDelta: number | null;
                customMetrics: {
                    [key: string]: number;
                };
            };
            meta: {
                requestId: string;
            };
        };
        DevProjectsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                name: string;
                summary: string | null;
                /** @enum {string} */
                status: "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
                /** Format: date */
                startDate: string | null;
                /** Format: date */
                targetDate: string | null;
                planId: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        DevProjectEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                name: string;
                summary: string | null;
                /** @enum {string} */
                status: "PLANNING" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
                /** Format: date */
                startDate: string | null;
                /** Format: date */
                targetDate: string | null;
                planId: string | null;
            };
            meta: {
                requestId: string;
            };
        };
        DevFeaturesEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                projectId: string;
                title: string;
                description: string | null;
                /** @enum {string} */
                status: "BACKLOG" | "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
                /** @enum {string} */
                priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                taskId: string | null;
                milestoneId: string | null;
                sortOrder: number;
            }[];
            meta: {
                requestId: string;
            };
        };
        DevFeatureEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                projectId: string;
                title: string;
                description: string | null;
                /** @enum {string} */
                status: "BACKLOG" | "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED";
                /** @enum {string} */
                priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                taskId: string | null;
                milestoneId: string | null;
                sortOrder: number;
            };
            meta: {
                requestId: string;
            };
        };
        DevDefectsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                projectId: string;
                featureId: string | null;
                taskId: string | null;
                title: string;
                description: string | null;
                reproductionSteps: string | null;
                /** @enum {string} */
                severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
                /** @enum {string} */
                status: "OPEN" | "CONFIRMED" | "FIXING" | "RESOLVED" | "CLOSED" | "WONT_FIX";
                foundVersion: string | null;
                resolvedVersion: string | null;
                /** Format: date-time */
                resolvedAt: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        DevDefectEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                projectId: string;
                featureId: string | null;
                taskId: string | null;
                title: string;
                description: string | null;
                reproductionSteps: string | null;
                /** @enum {string} */
                severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
                /** @enum {string} */
                status: "OPEN" | "CONFIRMED" | "FIXING" | "RESOLVED" | "CLOSED" | "WONT_FIX";
                foundVersion: string | null;
                resolvedVersion: string | null;
                /** Format: date-time */
                resolvedAt: string | null;
            };
            meta: {
                requestId: string;
            };
        };
        RepositoryLinksEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                projectId: string;
                name: string;
                /** Format: uri */
                url: string;
                description: string | null;
                sortOrder: number;
            }[];
            meta: {
                requestId: string;
            };
        };
        RepositoryLinkEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                projectId: string;
                name: string;
                /** Format: uri */
                url: string;
                description: string | null;
                sortOrder: number;
            };
            meta: {
                requestId: string;
            };
        };
        LearningResourcesEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                title: string;
                /** @enum {string} */
                resourceType: "COURSE" | "BOOK" | "ARTICLE" | "VIDEO" | "DOCUMENT" | "OTHER";
                author: string | null;
                /** Format: uri */
                sourceUrl: string | null;
                /** @enum {string} */
                status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "PAUSED" | "ABANDONED";
                progressCurrent: number | null;
                progressTotal: number | null;
                progressUnit: string | null;
                /** Format: date-time */
                startedAt: string | null;
                /** Format: date-time */
                completedAt: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        LearningResourceEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                title: string;
                /** @enum {string} */
                resourceType: "COURSE" | "BOOK" | "ARTICLE" | "VIDEO" | "DOCUMENT" | "OTHER";
                author: string | null;
                /** Format: uri */
                sourceUrl: string | null;
                /** @enum {string} */
                status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "PAUSED" | "ABANDONED";
                progressCurrent: number | null;
                progressTotal: number | null;
                progressUnit: string | null;
                /** Format: date-time */
                startedAt: string | null;
                /** Format: date-time */
                completedAt: string | null;
            };
            meta: {
                requestId: string;
            };
        };
        LearningSessionsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                resourceId: string | null;
                planId: string | null;
                taskId: string | null;
                /** Format: date */
                sessionDate: string;
                durationMinutes: number;
                progressDelta: number | null;
                summary: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        LearningSessionEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                resourceId: string | null;
                planId: string | null;
                taskId: string | null;
                /** Format: date */
                sessionDate: string;
                durationMinutes: number;
                progressDelta: number | null;
                summary: string | null;
            };
            meta: {
                requestId: string;
            };
        };
        SelfMediaTrendEnvelope: {
            data: {
                /** Format: date */
                date: string;
                views: number;
                likes: number;
                comments: number;
                favorites: number;
                shares: number;
                followerDelta: number;
            }[];
            meta: {
                requestId: string;
            };
        };
        DevProjectMilestonesEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                projectId: string;
                title: string;
                description: string | null;
                /** Format: date-time */
                dueAt: string;
                /** @enum {string} */
                status: "PENDING" | "AT_RISK" | "ACHIEVED" | "MISSED";
                /** Format: date-time */
                achievedAt: string | null;
                taskId: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        DevProjectMilestoneEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                projectId: string;
                title: string;
                description: string | null;
                /** Format: date-time */
                dueAt: string;
                /** @enum {string} */
                status: "PENDING" | "AT_RISK" | "ACHIEVED" | "MISSED";
                /** Format: date-time */
                achievedAt: string | null;
                taskId: string | null;
            };
            meta: {
                requestId: string;
            };
        };
        WorkNotesEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                title: string;
                /** @enum {string} */
                editorMode: "RICH_TEXT" | "MARKDOWN";
                markdownContent: string | null;
                richContent?: unknown;
                plainText: string;
                summary: string | null;
                /** @enum {string} */
                role: "SCRIPT" | "TECHNICAL" | "KNOWLEDGE" | "MATERIAL" | "OTHER";
            }[];
            meta: {
                requestId: string;
            };
        };
        WorkNoteEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                title: string;
                /** @enum {string} */
                editorMode: "RICH_TEXT" | "MARKDOWN";
                markdownContent: string | null;
                richContent?: unknown;
                plainText: string;
                summary: string | null;
                /** @enum {string} */
                role: "SCRIPT" | "TECHNICAL" | "KNOWLEDGE" | "MATERIAL" | "OTHER";
            };
            meta: {
                requestId: string;
            };
        };
        LinkedAttachmentsEnvelope: {
            data: {
                id: string;
                originalName: string;
                safeName: string;
                mediaType: string;
                extension: string | null;
                sizeBytes: number;
                sha256: string;
                storageKey: string;
                description: string | null;
                /** @enum {string} */
                status: "UPLOADING" | "READY" | "MISSING" | "QUARANTINED";
                /** @enum {string} */
                role: "GENERAL" | "MATERIAL" | "DOCUMENT" | "COVER";
            }[];
            meta: {
                requestId: string;
            };
        };
        LifeOverviewEnvelope: {
            data: {
                range: {
                    /** Format: date */
                    from: string;
                    /** Format: date */
                    to: string;
                };
                expenses: {
                    totalMinor: number;
                    shoppingMinor: number;
                    dietMinor: number;
                    entertainmentMinor: number;
                };
                budgets: {
                    totalMinor: number;
                    usedPercent: number;
                };
                shopping: {
                    pending: number;
                    purchased: number;
                    plannedMinor: number;
                    actualMinor: number;
                };
                diet: {
                    meals: number;
                    caloriesKcal: number;
                    caloriesRecordedMeals: number;
                    nutritionMissingMeals: number;
                    hydrationMl: number;
                };
                fitness: {
                    sessions: number;
                    durationMinutes: number;
                    caloriesBurned: number;
                    latestWeightKg: number | null;
                    recoveryLevel: number | null;
                };
                entertainment: {
                    items: number;
                    completed: number;
                    durationMinutes: number;
                };
            };
            meta: {
                requestId: string;
            };
        };
        ShoppingItemsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                name: string;
                productCategory: string | null;
                quantity: number;
                unit: string | null;
                plannedUnitPriceMinor: number | null;
                budgetAmountMinor: number | null;
                /** @enum {string} */
                priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                /** @enum {string} */
                status: "WANTED" | "RESEARCHING" | "READY" | "PURCHASED" | "CANCELLED";
                purchaseChannel: string | null;
                taskId: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        ShoppingItemEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                name: string;
                productCategory: string | null;
                quantity: number;
                unit: string | null;
                plannedUnitPriceMinor: number | null;
                budgetAmountMinor: number | null;
                /** @enum {string} */
                priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
                /** @enum {string} */
                status: "WANTED" | "RESEARCHING" | "READY" | "PURCHASED" | "CANCELLED";
                purchaseChannel: string | null;
                taskId: string | null;
            };
            meta: {
                requestId: string;
            };
        };
        PurchaseRecordsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                shoppingItemId: string | null;
                categoryId: string;
                productName: string;
                quantity: number;
                unitPriceMinor: number;
                totalAmountMinor: number;
                plannedTotalMinor: number | null;
                /** Format: date-time */
                purchasedAt: string;
                channel: string | null;
                expenseEntryId: string;
            }[];
            meta: {
                requestId: string;
            };
        };
        PurchaseRecordEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                shoppingItemId: string | null;
                categoryId: string;
                productName: string;
                quantity: number;
                unitPriceMinor: number;
                totalAmountMinor: number;
                plannedTotalMinor: number | null;
                /** Format: date-time */
                purchasedAt: string;
                channel: string | null;
                expenseEntryId: string;
            };
            meta: {
                requestId: string;
            };
        };
        BudgetsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string | null;
                /** @enum {string|null} */
                moduleType: "SHOPPING" | "DIET" | "ENTERTAINMENT" | null;
                /** @enum {string} */
                periodType: "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";
                /** Format: date */
                periodStart: string;
                /** Format: date */
                periodEnd: string;
                amountMinor: number;
                currency: string;
                alertThresholdPercent: number;
            }[];
            meta: {
                requestId: string;
            };
        };
        BudgetEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string | null;
                /** @enum {string|null} */
                moduleType: "SHOPPING" | "DIET" | "ENTERTAINMENT" | null;
                /** @enum {string} */
                periodType: "MONTH" | "QUARTER" | "YEAR" | "CUSTOM";
                /** Format: date */
                periodStart: string;
                /** Format: date */
                periodEnd: string;
                amountMinor: number;
                currency: string;
                alertThresholdPercent: number;
            };
            meta: {
                requestId: string;
            };
        };
        RecipesEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                name: string;
                description: string | null;
                servings: number;
                caloriesKcal: number | null;
                proteinG: number | null;
                carbsG: number | null;
                fatG: number | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        RecipeEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                name: string;
                description: string | null;
                servings: number;
                caloriesKcal: number | null;
                proteinG: number | null;
                carbsG: number | null;
                fatG: number | null;
            };
            meta: {
                requestId: string;
            };
        };
        MealPlansEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                /** Format: date */
                mealDate: string;
                /** @enum {string} */
                mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
                /** Format: date-time */
                plannedAt: string | null;
                recipeId: string | null;
                title: string;
                eventId: string | null;
                taskId: string | null;
                /** @enum {string} */
                status: "PLANNED" | "COMPLETED" | "SKIPPED";
            }[];
            meta: {
                requestId: string;
            };
        };
        MealPlanEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                /** Format: date */
                mealDate: string;
                /** @enum {string} */
                mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
                /** Format: date-time */
                plannedAt: string | null;
                recipeId: string | null;
                title: string;
                eventId: string | null;
                taskId: string | null;
                /** @enum {string} */
                status: "PLANNED" | "COMPLETED" | "SKIPPED";
            };
            meta: {
                requestId: string;
            };
        };
        MealRecordsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                mealPlanId: string | null;
                /** @enum {string} */
                mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
                title: string;
                /** Format: date-time */
                eatenAt: string;
                caloriesKcal: number | null;
                proteinG: number | null;
                carbsG: number | null;
                fatG: number | null;
                fiberG: number | null;
                sodiumMg: number | null;
                otherNutrition: {
                    [key: string]: unknown;
                };
                expenseEntryId: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        MealRecordEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                mealPlanId: string | null;
                /** @enum {string} */
                mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
                title: string;
                /** Format: date-time */
                eatenAt: string;
                caloriesKcal: number | null;
                proteinG: number | null;
                carbsG: number | null;
                fatG: number | null;
                fiberG: number | null;
                sodiumMg: number | null;
                otherNutrition: {
                    [key: string]: unknown;
                };
                expenseEntryId: string | null;
            };
            meta: {
                requestId: string;
            };
        };
        HydrationRecordsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                /** Format: date-time */
                recordedAt: string;
                amountMl: number;
                note: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        HydrationRecordEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                /** Format: date-time */
                recordedAt: string;
                amountMl: number;
                note: string | null;
            };
            meta: {
                requestId: string;
            };
        };
        DietaryPreferencesEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                /** @enum {string} */
                preferenceType: "LIKE" | "DISLIKE" | "ALLERGY" | "INTOLERANCE" | "RESTRICTION";
                name: string;
                severity: string | null;
                note: string | null;
                isActive: boolean;
            }[];
            meta: {
                requestId: string;
            };
        };
        DietaryPreferenceEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                /** @enum {string} */
                preferenceType: "LIKE" | "DISLIKE" | "ALLERGY" | "INTOLERANCE" | "RESTRICTION";
                name: string;
                severity: string | null;
                note: string | null;
                isActive: boolean;
            };
            meta: {
                requestId: string;
            };
        };
        ExercisesEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                name: string;
                /** @enum {string} */
                exerciseType: "STRENGTH" | "CARDIO" | "MOBILITY" | "SPORT" | "OTHER";
                muscleGroups: string[];
                defaultUnit: string | null;
                instructions: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        ExerciseEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                name: string;
                /** @enum {string} */
                exerciseType: "STRENGTH" | "CARDIO" | "MOBILITY" | "SPORT" | "OTHER";
                muscleGroups: string[];
                defaultUnit: string | null;
                instructions: string | null;
            };
            meta: {
                requestId: string;
            };
        };
        WorkoutPlansEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                name: string;
                description: string | null;
                goalId: string | null;
                /** @enum {string} */
                status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
                items: {
                    id: string;
                    exerciseId: string;
                    setsTarget: number | null;
                    repsTarget: string | null;
                    weightTarget: number | null;
                    durationSecondsTarget: number | null;
                    distanceTarget: number | null;
                    sortOrder: number;
                }[];
            }[];
            meta: {
                requestId: string;
            };
        };
        WorkoutPlanEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                name: string;
                description: string | null;
                goalId: string | null;
                /** @enum {string} */
                status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED";
                items: {
                    id: string;
                    exerciseId: string;
                    setsTarget: number | null;
                    repsTarget: string | null;
                    weightTarget: number | null;
                    durationSecondsTarget: number | null;
                    distanceTarget: number | null;
                    sortOrder: number;
                }[];
            };
            meta: {
                requestId: string;
            };
        };
        WorkoutSessionsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                workoutPlanId: string | null;
                taskId: string | null;
                /** Format: date-time */
                startedAt: string;
                /** Format: date-time */
                endedAt: string;
                durationMinutes: number;
                caloriesBurned: number | null;
                perceivedEffort: number | null;
                note: string | null;
                sets: {
                    id: string;
                    exerciseId: string;
                    setNumber: number;
                    reps: number | null;
                    weight: number | null;
                    durationSeconds: number | null;
                    distance: number | null;
                    completed: boolean;
                }[];
            }[];
            meta: {
                requestId: string;
            };
        };
        WorkoutSessionEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                workoutPlanId: string | null;
                taskId: string | null;
                /** Format: date-time */
                startedAt: string;
                /** Format: date-time */
                endedAt: string;
                durationMinutes: number;
                caloriesBurned: number | null;
                perceivedEffort: number | null;
                note: string | null;
                sets: {
                    id: string;
                    exerciseId: string;
                    setNumber: number;
                    reps: number | null;
                    weight: number | null;
                    durationSeconds: number | null;
                    distance: number | null;
                    completed: boolean;
                }[];
            };
            meta: {
                requestId: string;
            };
        };
        BodyMeasurementsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                /** Format: date-time */
                measuredAt: string;
                weightKg: number | null;
                bodyFatPercent: number | null;
                waistCm: number | null;
                chestCm: number | null;
                hipCm: number | null;
                note: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        BodyMeasurementEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                /** Format: date-time */
                measuredAt: string;
                weightKg: number | null;
                bodyFatPercent: number | null;
                waistCm: number | null;
                chestCm: number | null;
                hipCm: number | null;
                note: string | null;
            };
            meta: {
                requestId: string;
            };
        };
        PersonalRecordsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                exerciseId: string | null;
                /** @enum {string} */
                recordType: "WEIGHT" | "REPS" | "DURATION" | "DISTANCE" | "SPEED" | "OTHER";
                value: number;
                unit: string;
                /** Format: date-time */
                achievedAt: string;
                workoutSessionId: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        PersonalRecordEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                exerciseId: string | null;
                /** @enum {string} */
                recordType: "WEIGHT" | "REPS" | "DURATION" | "DISTANCE" | "SPEED" | "OTHER";
                value: number;
                unit: string;
                /** Format: date-time */
                achievedAt: string;
                workoutSessionId: string | null;
            };
            meta: {
                requestId: string;
            };
        };
        RecoveryRecordsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                /** Format: date */
                recordedDate: string;
                recoveryLevel: number;
                sorenessLevel: number | null;
                energyLevel: number | null;
                note: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        RecoveryRecordEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                /** Format: date */
                recordedDate: string;
                recoveryLevel: number;
                sorenessLevel: number | null;
                energyLevel: number | null;
                note: string | null;
            };
            meta: {
                requestId: string;
            };
        };
        EntertainmentItemsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                title: string;
                /** @enum {string} */
                itemType: "MOVIE" | "SERIES" | "BOOK" | "COMIC" | "GAME" | "ACTIVITY" | "TRIP" | "OTHER";
                /** @enum {string} */
                listType: "WANT_TO_WATCH" | "WANT_TO_PLAY" | "WANT_TO_GO" | "OTHER";
                /** @enum {string} */
                status: "WISHLIST" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "DROPPED";
                progressCurrent: number | null;
                progressTotal: number | null;
                progressUnit: string | null;
                /** Format: date-time */
                startedAt: string | null;
                /** Format: date-time */
                completedAt: string | null;
                rating: number | null;
                note: string | null;
                tripDetails: {
                    /** Format: date-time */
                    startAt: string | null;
                    /** Format: date-time */
                    endAt: string | null;
                    location: string | null;
                    eventId: string | null;
                    taskId: string | null;
                    details: {
                        [key: string]: unknown;
                    };
                } | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        EntertainmentItemEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                categoryId: string;
                title: string;
                /** @enum {string} */
                itemType: "MOVIE" | "SERIES" | "BOOK" | "COMIC" | "GAME" | "ACTIVITY" | "TRIP" | "OTHER";
                /** @enum {string} */
                listType: "WANT_TO_WATCH" | "WANT_TO_PLAY" | "WANT_TO_GO" | "OTHER";
                /** @enum {string} */
                status: "WISHLIST" | "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "DROPPED";
                progressCurrent: number | null;
                progressTotal: number | null;
                progressUnit: string | null;
                /** Format: date-time */
                startedAt: string | null;
                /** Format: date-time */
                completedAt: string | null;
                rating: number | null;
                note: string | null;
                tripDetails: {
                    /** Format: date-time */
                    startAt: string | null;
                    /** Format: date-time */
                    endAt: string | null;
                    location: string | null;
                    eventId: string | null;
                    taskId: string | null;
                    details: {
                        [key: string]: unknown;
                    };
                } | null;
            };
            meta: {
                requestId: string;
            };
        };
        EntertainmentSessionsEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                itemId: string;
                /** Format: date */
                sessionDate: string;
                durationMinutes: number;
                progressDelta: number | null;
                note: string | null;
            }[];
            meta: {
                requestId: string;
            };
        };
        EntertainmentSessionEnvelope: {
            data: {
                id: string;
                version: number;
                /** Format: date-time */
                createdAt: string;
                /** Format: date-time */
                updatedAt: string;
                itemId: string;
                /** Format: date */
                sessionDate: string;
                durationMinutes: number;
                progressDelta: number | null;
                note: string | null;
            };
            meta: {
                requestId: string;
            };
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;

