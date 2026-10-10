import { CLASS_PREFIX } from '@/constants';
import {
  EUploadFileStatus,
  isDragWithFiles,
  isImageFile,
  simpleHTMLDecode,
} from '@/utils/dom';
import { PlusOutlined } from 'antd-icons6';
import { Attachments, type AttachmentsProps } from '@ant-design/x';
import { useMemoizedFn, useSetState } from 'ahooks';
import { Button, Flex, GetRef, type UploadFile } from 'antd6';
import axios from 'axios';
import React, {
  createContext,
  forwardRef,
  memo,
  ReactNode,
  RefObject,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import type { IChatSenderUploadProps, IUploadFile } from '../../types';

/**
 * 附件模块负责隔离文件选择、上传进度、拖拽交互和临时资源生命周期。
 */
const classPrefix = `${CLASS_PREFIX}-chat-sender`;
const DEFAULT_DROP_PLACEHOLDER: NonNullable<AttachmentsProps['placeholder']> = {
  description: '拖拽文件到此处上传',
};

function safeJsonParse(value: string) {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

/**
 * 单次附件状态更新内容。
 */
interface IUpdateFileOptions {
  status: EUploadFileStatus;
  percent?: number;
  fileUrl?: string;
}

/**
 * 定位并更新单个附件所需参数。
 */
interface IUpdateFileParams {
  uid: string;
  options: IUpdateFileOptions;
}

/**
 * 释放本地预览地址所需参数。
 */
interface IRevokePreviewUrlParams {
  uid: string;
  previewUrls: Map<string, string>;
}

/**
 * 自定义上传单个附件所需参数。
 */
interface IUploadWithCustomHandlerParams {
  fileItem: IUploadFile;
  onUpload: NonNullable<IChatSenderUploadProps['onUpload']>;
}

/**
 * 通过接口地址上传单个附件所需参数。
 */
interface IUploadWithActionParams {
  fileItem: IUploadFile;
  uploadProps: IChatSenderUploadProps;
}

/**
 * 拖拽蒙层支持的结构化提示内容。
 */
interface IDropPlaceholderConfig {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
}

/**
 * 附件上传入口依赖的稳定操作集合。
 */
interface IAttachmentActions {
  attachmentsRef: RefObject<GetRef<typeof Attachments>>;
  disabled: boolean;
  handleAttachmentsChange: NonNullable<AttachmentsProps['onChange']>;
  removeFile: (file: UploadFile) => void;
}

/**
 * 附件状态容器属性。
 */
interface IAttachmentProviderProps {
  children: ReactNode;
  disabled: boolean;
  uploadProps?: IChatSenderUploadProps;
  senderContainerRef: RefObject<HTMLDivElement>;
}

/**
 * ChatSender 调用附件状态容器的命令接口。
 */
export interface IAttachmentController {
  clear: () => void;
  getFileList: () => IUploadFile[];
  uploadFiles: (files: FileList) => void;
}

/**
 * 附件上传操作区属性。
 */
interface IAttachmentUploadActionsProps {
  prefix?: ReactNode;
  suffix?: ReactNode;
}

// 高频变化的展示列表单独维护，避免上传进度刷新上传按钮。
const AttachmentFileListContext = createContext<IUploadFile[]>([]);
// 仅在附件增删时变化的选择列表，用于同步 Attachments 内部状态。
const AttachmentSelectedListContext = createContext<IUploadFile[]>([]);
// 操作集合始终保持稳定，避免文件状态更新穿透到非订阅组件。
const AttachmentActionsContext = createContext<IAttachmentActions | null>(null);

/**
 * 获取附件状态，供附件头部按需订阅文件列表变化。
 */
export function useAttachmentFileList() {
  return useContext(AttachmentFileListContext);
}

/**
 * 获取稳定的附件操作，避免文件列表更新带动上传按钮重渲染。
 */
export function useAttachmentActions() {
  return useContext(AttachmentActionsContext);
}

/**
 * 释放指定文件对应的本地预览地址。
 */
function revokePreviewUrl(params: IRevokePreviewUrlParams) {
  const { uid, previewUrls } = params;
  const previewUrl = previewUrls.get(uid);
  if (!previewUrl) {
    return;
  }

  URL.revokeObjectURL(previewUrl);
  previewUrls.delete(uid);
}

/**
 * 管理附件选择、上传进度和拖拽状态，使高频进度更新不穿透到 Sender。
 */
function InnerAttachmentProvider(
  props: IAttachmentProviderProps,
  ref: React.Ref<IAttachmentController>,
) {
  const { children, disabled, uploadProps, senderContainerRef } = props;
  const [state, setState] = useSetState({
    // fileList 包含实时上传状态，只提供给附件头部展示。
    fileList: [] as IUploadFile[],
    // selectedFileList 仅在增删附件时变化，避免上传进度刷新选择按钮。
    selectedFileList: [] as IUploadFile[],
    isFileDragging: false,
  });
  // 稳定函数通过 Ref 获取最新值，无需把状态加入依赖并反复创建回调。
  const stateRef = useRef(state);
  stateRef.current = state;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const uploadPropsRef = useRef(uploadProps);
  uploadPropsRef.current = uploadProps;
  const attachmentsRef = useRef<GetRef<typeof Attachments>>(null);
  const dropContainerRef = useRef<HTMLElement | null>(null);
  // Ref 记录瞬时拖拽状态，用来拦截 dragenter 等事件的重复更新。
  const isFileDraggingRef = useRef(false);
  // Set 同时承担上传任务存活标记；删除文件后，迟到的异步回调会被直接忽略。
  const uploadingFileUidsRef = useRef(new Set<string>());
  // 分开记录进度和更新时间，既过滤相同百分比，也限制每个文件的刷新频率。
  const uploadProgressRef = useRef<Record<string, number>>({});
  const uploadProgressUpdatedAtRef = useRef<Record<string, number>>({});
  // 只登记本组件创建的 Object URL，防止误释放调用方传入的远程地址。
  const previewUrlsRef = useRef(new Map<string, string>());
  // action 上传可以主动取消；自定义 onUpload 是否支持取消由调用方自行决定。
  const abortControllersRef = useRef(new Map<string, AbortController>());

  /**
   * 清理单个文件关联的上传与预览资源。
   */
  const cleanupFileResources = useMemoizedFn((uid: string) => {
    // 先移除存活标记，确保 abort 产生的异步回调不会再写入文件状态。
    uploadingFileUidsRef.current.delete(uid);
    delete uploadProgressRef.current[uid];
    delete uploadProgressUpdatedAtRef.current[uid];
    abortControllersRef.current.get(uid)?.abort();
    abortControllersRef.current.delete(uid);
    revokePreviewUrl({ uid, previewUrls: previewUrlsRef.current });
  });

  /**
   * 清空所有附件，并释放组件创建的临时资源。
   */
  const clear = useMemoizedFn(() => {
    stateRef.current.fileList.forEach((file) => {
      cleanupFileResources(file.uid);
    });
    setState({ fileList: [], selectedFileList: [] });
  });

  /**
   * 更新文件拖入状态，相同状态不重复触发渲染。
   */
  const updateFileDragging = useMemoizedFn((isFileDragging: boolean) => {
    if (isFileDraggingRef.current === isFileDragging) {
      return;
    }

    isFileDraggingRef.current = isFileDragging;
    setState({ isFileDragging });
  });

  /**
   * 更新单个附件的上传状态，并限制上传进度的刷新频率。
   */
  const updateFile = useMemoizedFn((params: IUpdateFileParams) => {
    const { uid, options } = params;
    // 文件可能已被删除或整体清空，此时忽略仍在队列中的进度与完成回调。
    if (!uploadingFileUidsRef.current.has(uid)) {
      return;
    }

    const now = Date.now();
    const isProgressUpdate =
      options.status === EUploadFileStatus.uploading &&
      options.percent !== undefined &&
      options.percent < 100;
    const lastProgress = uploadProgressRef.current[uid];
    const lastUpdatedAt = uploadProgressUpdatedAtRef.current[uid] || 0;

    if (
      isProgressUpdate &&
      (lastProgress === options.percent || now - lastUpdatedAt < 100)
    ) {
      // 普通进度最多每 100ms 更新一次；完成和失败状态不受该限制。
      return;
    }

    if (isProgressUpdate && options.percent !== undefined) {
      uploadProgressRef.current[uid] = options.percent;
      uploadProgressUpdatedAtRef.current[uid] = now;
    }

    setState((previousState) => {
      const fileIndex = previousState.fileList.findIndex(
        (file) => file.uid === uid,
      );
      if (fileIndex < 0) {
        // 状态列表中已不存在该文件时，不创建无意义的新状态对象。
        return null;
      }

      // 只替换发生变化的文件，其他 FileCard 可继续通过 memo 跳过渲染。
      const nextFileList = [...previousState.fileList];
      nextFileList[fileIndex] = {
        ...nextFileList[fileIndex],
        status: options.status,
        ...(options.percent !== undefined ? { percent: options.percent } : {}),
        ...(options.fileUrl ? { fileUrl: options.fileUrl } : {}),
      };
      return { fileList: nextFileList };
    });
  });

  /**
   * 结束上传并清理不再需要的进度记录。
   */
  const finishUpload = useMemoizedFn((uid: string) => {
    uploadingFileUidsRef.current.delete(uid);
    delete uploadProgressRef.current[uid];
    delete uploadProgressUpdatedAtRef.current[uid];
    abortControllersRef.current.delete(uid);
  });

  /**
   * 使用自定义上传函数上传单个附件。
   */
  const uploadWithCustomHandler = useMemoizedFn(
    (params: IUploadWithCustomHandlerParams) => {
      const { fileItem, onUpload } = params;
      const file = fileItem.originFileObj as File;
      if (!file) {
        return;
      }

      updateFile({
        uid: fileItem.uid,
        options: { status: EUploadFileStatus.uploading, percent: 0 },
      });
      // 自定义上传可能同步触发首个进度，统一交给 updateFile 节流和校验。
      onUpload(file, (percent) => {
        updateFile({
          uid: fileItem.uid,
          options: { status: EUploadFileStatus.uploading, percent },
        });
      })
        .then((fileUrl) => {
          updateFile({
            uid: fileItem.uid,
            options: fileUrl
              ? {
                  percent: 100,
                  status: EUploadFileStatus.done,
                  fileUrl,
                }
              : { status: EUploadFileStatus.error },
          });
        })
        .catch(() => {
          updateFile({
            uid: fileItem.uid,
            options: { status: EUploadFileStatus.error },
          });
        })
        .finally(() => {
          finishUpload(fileItem.uid);
        });
    },
  );

  /**
   * 使用 multipart/form-data 接口上传单个附件。
   */
  const uploadWithAction = useMemoizedFn((params: IUploadWithActionParams) => {
    const { fileItem, uploadProps: currentUploadProps } = params;
    const { action, name = 'file', headers, getFileUrl } = currentUploadProps;
    if (!action || !fileItem.originFileObj) {
      return;
    }

    const formData = new FormData();
    formData.append(name, fileItem.originFileObj as File);
    const abortController = new AbortController();
    // 按 uid 保存控制器，删除单个附件时只取消对应请求。
    abortControllersRef.current.set(fileItem.uid, abortController);

    axios({
      method: 'post',
      url: action,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...headers,
      },
      withCredentials: true,
      signal: abortController.signal,
      /**
       * 将上传进度同步到对应文件，频率由 updateFile 统一限制。
       */
      onUploadProgress(progressEvent) {
        if (!progressEvent.lengthComputable || !progressEvent.total) {
          return;
        }

        const percent = Math.round(
          (progressEvent.loaded / progressEvent.total) * 100,
        );
        updateFile({
          uid: fileItem.uid,
          options: {
            status: EUploadFileStatus.uploading,
            percent,
          },
        });
      },
    })
      .then((response) => {
        let result = response?.data;
        // 部分网关会把 JSON 作为 HTML 编码后的字符串返回，需要先解码再取文件地址。
        if (typeof result === 'string' && result.startsWith('{')) {
          const decoded = safeJsonParse(simpleHTMLDecode(result));
          if (Object.keys(decoded).length) {
            result = decoded;
          }
        }

        const fileUrl = getFileUrl?.(result) || '';
        updateFile({
          uid: fileItem.uid,
          options: fileUrl
            ? {
                percent: 100,
                status: EUploadFileStatus.done,
                fileUrl,
              }
            : { status: EUploadFileStatus.error },
        });
      })
      .catch((error) => {
        if (!axios.isCancel(error)) {
          updateFile({
            uid: fileItem.uid,
            options: { status: EUploadFileStatus.error },
          });
        }
      })
      .finally(() => {
        finishUpload(fileItem.uid);
      });
  });

  /**
   * 立即并行启动新附件上传，图片预览不会再阻塞网络请求。
   */
  const startUploads = useMemoizedFn((newFiles: IUploadFile[]) => {
    const currentUploadProps = uploadPropsRef.current;
    const { action, onUpload } = currentUploadProps || {};
    if (!onUpload && !action) {
      return;
    }

    newFiles.forEach((fileItem) => {
      if (!fileItem.originFileObj) {
        return;
      }

      uploadingFileUidsRef.current.add(fileItem.uid);
      // 不在循环中 await，保证多个文件立即并行启动；onUpload 的优先级高于 action。
      if (onUpload) {
        uploadWithCustomHandler({ fileItem, onUpload });
      } else if (currentUploadProps) {
        uploadWithAction({ fileItem, uploadProps: currentUploadProps });
      }
    });
  });

  /**
   * 接收 Attachments 的完整列表，仅合并新增文件并保留已有上传状态。
   */
  const handleAttachmentsChange = useMemoizedFn<
    NonNullable<AttachmentsProps['onChange']>
  >(({ fileList }) => {
    if (disabledRef.current) {
      return;
    }

    const previousFiles = new Map(
      stateRef.current.fileList.map((file) => [file.uid, file]),
    );
    const newFiles: IUploadFile[] = [];
    const nextFileList = fileList.map((file) => {
      const previousFile = previousFiles.get(file.uid);
      if (previousFile) {
        // Attachments 返回的是完整列表，沿用已有对象以保留上传进度和远程地址。
        return previousFile;
      }

      const nextFile = { ...file } as IUploadFile;
      if (isImageFile(nextFile) && nextFile.originFileObj) {
        // Object URL 创建是同步的，不会像 Base64 读取一样阻塞后续文件上传。
        const previewUrl = URL.createObjectURL(nextFile.originFileObj);
        previewUrlsRef.current.set(nextFile.uid, previewUrl);
        nextFile.url = previewUrl;
      }
      newFiles.push(nextFile);
      return nextFile;
    });

    // 先把新文件写入状态，再启动上传，后续同步进度才能定位到对应 uid。
    setState({
      fileList: nextFileList,
      selectedFileList: nextFileList,
    });
    startUploads(newFiles);
  });

  /**
   * 将拖放文件写入 Attachments 隐藏输入框，复用统一的附件处理入口。
   */
  const uploadDroppedFiles = useMemoizedFn((files?: FileList | null) => {
    const fileInput = attachmentsRef.current?.fileNativeElement;
    if (!fileInput || !files?.length) {
      return;
    }

    // 浏览器不允许直接构造 FileList，通过 DataTransfer 生成后触发原生 change。
    const dataTransfer = new DataTransfer();
    Array.from(files).forEach((file) => {
      dataTransfer.items.add(file);
    });
    fileInput.files = dataTransfer.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  });

  /**
   * 删除附件，同时取消请求并释放本地预览。
   */
  const removeFile = useMemoizedFn((file: UploadFile) => {
    cleanupFileResources(file.uid);
    setState((previousState) => {
      // 同时清理展示列表和选择列表，防止下次选择时已删除附件重新出现。
      const filterRemovedFile = (item: IUploadFile) => item.uid !== file.uid;
      return {
        fileList: previousState.fileList.filter(filterRemovedFile),
        selectedFileList:
          previousState.selectedFileList.filter(filterRemovedFile),
      };
    });
    uploadPropsRef.current?.onRemove?.(file);
  });

  const actionsRef = useRef<IAttachmentActions | null>(null);
  if (!actionsRef.current || actionsRef.current.disabled !== disabled) {
    // disabled 变化时更新 Context 引用以通知按钮，其它状态变化仍复用操作对象。
    actionsRef.current = {
      attachmentsRef,
      disabled,
      handleAttachmentsChange,
      removeFile,
    };
  }

  /**
   * 对外暴露读取、清空和粘贴上传能力，提交时无需订阅附件状态。
   */
  useImperativeHandle(ref, () => ({
    clear,
    // 提交消息时按需读取最新列表，ChatSender 无需订阅每一次上传进度。
    getFileList: () => stateRef.current.fileList,
    uploadFiles: (files: FileList) => {
      if (disabledRef.current) {
        return;
      }
      for (const file of files) {
        attachmentsRef.current?.upload(file);
      }
    },
  }));

  /**
   * 仅监听指定容器内的文件拖拽，并在离开或取消时关闭蒙层。
   */
  useEffect(() => {
    const dropContainer =
      uploadProps?.getDropContainer?.() ?? senderContainerRef.current;
    // Portal 渲染和事件监听必须使用同一个实际容器，避免蒙层与命中区域错位。
    dropContainerRef.current = dropContainer;

    if (!dropContainer || disabled) {
      updateFileDragging(false);
      return undefined;
    }

    const activeDropContainer = dropContainer;

    /**
     * 文件进入容器时展示拖拽蒙层。
     */
    function handleDragEnter(event: DragEvent) {
      if (isDragWithFiles(event)) {
        updateFileDragging(true);
      }
    }

    /**
     * 文件停留时允许执行放置操作。
     */
    function handleDragOver(event: DragEvent) {
      if (!isDragWithFiles(event)) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy';
      }
    }

    /**
     * 仅在指针真正离开容器边界时关闭蒙层。
     */
    function handleDragLeave(event: DragEvent) {
      const nextTarget = event.relatedTarget;
      if (
        nextTarget instanceof Node &&
        activeDropContainer.contains(nextTarget)
      ) {
        // relatedTarget 仍在容器内，说明只是经过内部子节点，不是真正离开。
        return;
      }

      // 某些浏览器的 relatedTarget 可能为空，再用坐标做一次边界兜底判断。
      const rect = activeDropContainer.getBoundingClientRect();
      const isPointerInside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!isPointerInside) {
        updateFileDragging(false);
      }
    }

    /**
     * 文件放下后关闭蒙层并进入统一上传流程。
     */
    function handleDrop(event: DragEvent) {
      if (!isDragWithFiles(event)) {
        return;
      }
      event.preventDefault();
      updateFileDragging(false);
      uploadDroppedFiles(event.dataTransfer?.files);
    }

    /**
     * 拖拽结束、窗口失焦或外部放下时兜底关闭蒙层。
     */
    function handleDragEnd() {
      updateFileDragging(false);
    }

    activeDropContainer.addEventListener('dragenter', handleDragEnter);
    activeDropContainer.addEventListener('dragover', handleDragOver);
    activeDropContainer.addEventListener('dragleave', handleDragLeave);
    activeDropContainer.addEventListener('drop', handleDrop);
    document.addEventListener('drop', handleDragEnd);
    document.addEventListener('dragend', handleDragEnd);
    window.addEventListener('blur', handleDragEnd);

    return () => {
      activeDropContainer.removeEventListener('dragenter', handleDragEnter);
      activeDropContainer.removeEventListener('dragover', handleDragOver);
      activeDropContainer.removeEventListener('dragleave', handleDragLeave);
      activeDropContainer.removeEventListener('drop', handleDrop);
      document.removeEventListener('drop', handleDragEnd);
      document.removeEventListener('dragend', handleDragEnd);
      window.removeEventListener('blur', handleDragEnd);
      dropContainerRef.current = null;
      updateFileDragging(false);
    };
  }, [disabled, uploadProps?.getDropContainer]);

  /**
   * 组件卸载时中止请求并释放所有 Object URL。
   */
  useEffect(() => {
    return () => {
      // 卸载阶段只清理外部资源，不再 setState，避免产生卸载后的状态更新。
      uploadingFileUidsRef.current.clear();
      abortControllersRef.current.forEach((controller) => controller.abort());
      abortControllersRef.current.clear();
      previewUrlsRef.current.forEach((previewUrl) => {
        URL.revokeObjectURL(previewUrl);
      });
      previewUrlsRef.current.clear();
    };
  }, []);

  /**
   * 渲染拖拽提示内容，兼容自定义节点和配置对象。
   */
  function renderDropPlaceholder() {
    const placeholder = uploadProps?.placeholder ?? DEFAULT_DROP_PLACEHOLDER;
    const content =
      typeof placeholder === 'function' ? placeholder('drop') : placeholder;
    if (React.isValidElement(content)) {
      return content;
    }

    const { icon, title, description } =
      (content as IDropPlaceholderConfig) || {};
    return (
      <>
        {icon ? (
          <div className={`${classPrefix}__drop-placeholder-icon`}>{icon}</div>
        ) : null}
        {title ? (
          <div className={`${classPrefix}__drop-placeholder-title`}>
            {title}
          </div>
        ) : null}
        {description ? (
          <div className={`${classPrefix}__drop-placeholder-description`}>
            {description}
          </div>
        ) : null}
      </>
    );
  }

  const dropContainer = dropContainerRef.current;

  return (
    <AttachmentActionsContext.Provider value={actionsRef.current}>
      {/* 选择列表与展示列表分层订阅，上传进度只会通知附件头部。 */}
      <AttachmentSelectedListContext.Provider value={state.selectedFileList}>
        <AttachmentFileListContext.Provider value={state.fileList}>
          {children}
        </AttachmentFileListContext.Provider>
      </AttachmentSelectedListContext.Provider>
      {state.isFileDragging && dropContainer
        ? createPortal(
            <div
              className={`${classPrefix}__drop-area`}
              role="status"
              aria-live="polite"
            >
              <div className={`${classPrefix}__drop-placeholder`}>
                {renderDropPlaceholder()}
              </div>
            </div>,
            // 支持把蒙层挂到整个会话区域，而不局限于输入框节点。
            dropContainer,
          )
        : null}
    </AttachmentActionsContext.Provider>
  );
}

export const AttachmentProvider = forwardRef(InnerAttachmentProvider);

/**
 * 渲染附件选择按钮，组件不订阅文件列表和上传进度。
 */
export const AttachmentUploadActions = memo(
  (props: IAttachmentUploadActionsProps) => {
    const { prefix, suffix } = props;
    const actions = useContext(AttachmentActionsContext);
    const selectedFileList = useContext(AttachmentSelectedListContext);
    if (!actions) {
      return null;
    }

    return (
      <Flex gap="small" align="center" className={`${classPrefix}__upload-row`}>
        {prefix}
        <Attachments
          ref={actions.attachmentsRef}
          disabled={actions.disabled}
          beforeUpload={() => false}
          items={selectedFileList}
          onChange={actions.handleAttachmentsChange}
          // 关闭 Attachments 自带的全局拖拽区，由 Provider 的精确容器监听统一处理。
          getDropContainer={null}
        >
          <Button
            type="text"
            disabled={actions.disabled}
            icon={<PlusOutlined className={`${classPrefix}__upload`} />}
          />
        </Attachments>
        {suffix}
      </Flex>
    );
  },
);

AttachmentUploadActions.displayName = 'AttachmentUploadActions';
