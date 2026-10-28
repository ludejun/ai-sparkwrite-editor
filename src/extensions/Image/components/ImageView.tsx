import { NodeViewWrapper } from '@tiptap/react';
import { clamp, isNumber, throttle } from 'lodash-es';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { IMAGE_MAX_SIZE, IMAGE_MIN_SIZE, IMAGE_THROTTLE_WAIT_TIME } from '@/constants';
import { CAPTION_CLASS } from '@/extensions/Image/caption';
import { parseRotation } from '@/extensions/Image/Image';
import { useLocale } from '@/locales';
import { useEditableEditor } from '@/store/store';
import { isEditorEditable } from '@/utils/editable';

import type { NodeViewProps } from '@tiptap/react';

export {
  CAPTION_CLASS,
  isImageCaptionEvent,
  isInsideImageCaption,
} from '@/extensions/Image/caption';

interface Size {
  width: number;
  height: number;
}

const ResizeDirection = {
  TOP_LEFT: 'tl',
  TOP_RIGHT: 'tr',
  BOTTOM_LEFT: 'bl',
  BOTTOM_RIGHT: 'br',
};

function ImageView(props: NodeViewProps) {
  const { updateAttributes } = props;
  const { t } = useLocale();
  // Node views do not re-render on `setEditable`; subscribe to it.
  const editable = useEditableEditor(props.editor);

  const [maxSize, setMaxSize] = useState<Size>({
    width: IMAGE_MAX_SIZE,
    height: IMAGE_MAX_SIZE,
  });

  const [naturalSize, setNaturalSize] = useState<Size>({ width: 0, height: 0 });

  const [originalSize, setOriginalSize] = useState({
    width: 0,
    height: 0,
  });

  const [resizeDirections] = useState<string[]>([
    ResizeDirection.TOP_LEFT,
    ResizeDirection.TOP_RIGHT,
    ResizeDirection.BOTTOM_LEFT,
    ResizeDirection.BOTTOM_RIGHT,
  ]);

  const [resizing, setResizing] = useState<boolean>(false);

  const resizeSession = useRef<{
    pointerId: number;
    x: number;
    width: number;
    direction: string;
  } | null>(null);

  const { align, inline, caption } = props?.node?.attrs;
  const isBlockNode = props?.node?.type?.name === 'imageBlock';
  const isInline = !isBlockNode && (inline === true || inline === 'true');
  const inlineFloat = isInline && (align === 'left' || align === 'right');

  const rotate = parseRotation(props?.node?.attrs?.rotate);
  const quarterTurn = rotate === 90 || rotate === 270;
  const hasCaption = isBlockNode && typeof caption === 'string';

  // Focus the caption only when one is actually added, not every time a
  // document that already has captions renders.
  const [captionFocusToken, setCaptionFocusToken] = useState(0);
  const hadCaption = useRef(hasCaption);

  useEffect(() => {
    if (hasCaption && !hadCaption.current) {
      setCaptionFocusToken((token) => token + 1);
    }

    hadCaption.current = hasCaption;
  }, [hasCaption]);

  /**
   * A quarter turn keeps the image's layout box but swaps its visual footprint,
   * so reserve the swapped box and centre the rotated image inside it.
   * Percentage widths have no pixel size to swap, so they just rotate.
   */
  const rotatedBox = useMemo(() => {
    if (!quarterTurn || !naturalSize.width || !naturalSize.height) {
      return null;
    }

    const attrWidth = props?.node?.attrs?.width;
    const widthPx =
      typeof attrWidth === 'number'
        ? attrWidth
        : typeof attrWidth === 'string' && attrWidth.endsWith('px')
          ? Number.parseFloat(attrWidth)
          : null;

    if (attrWidth && widthPx === null) {
      return null;
    }

    const displayWidth = widthPx ?? naturalSize.width;
    const displayHeight = displayWidth * (naturalSize.height / naturalSize.width);

    return { width: displayHeight, height: displayWidth };
  }, [quarterTurn, naturalSize, props?.node?.attrs?.width]);

  const imgAttrs = useMemo(() => {
    const { src, alt, width: w, height: h, flipX, flipY } = props?.node?.attrs;

    const width = isNumber(w) ? `${w}px` : w;
    const height = isNumber(h) ? `${h}px` : h;
    const transformStyles: string[] = [];

    if (rotatedBox) transformStyles.push('translate(-50%, -50%)');
    if (flipX) transformStyles.push('rotateX(180deg)');
    if (flipY) transformStyles.push('rotateY(180deg)');
    if (rotate) transformStyles.push(`rotate(${rotate}deg)`);
    const transform = transformStyles.join(' ');

    const floatStyle = inlineFloat ? { float: align } : {};
    // `.ProseMirror img { max-width: 100% }` would re-clamp the image to the
    // swapped (narrower) box and leave it floating in a half-empty frame.
    const rotatedStyle: React.CSSProperties = rotatedBox
      ? { position: 'absolute', left: '50%', top: '50%', maxWidth: 'none', maxHeight: 'none' }
      : {};

    return {
      src: src || undefined,
      alt: alt || undefined,
      style: {
        width: width || undefined,
        height: height || undefined,
        transform: transform || 'none',
        ...floatStyle,
        ...rotatedStyle,
      },
    };
  }, [props?.node?.attrs, inlineFloat, align, rotate, rotatedBox]);

  const imageMaxStyle = useMemo(() => {
    const {
      style: { width },
    } = imgAttrs;

    return { width: width === '100%' ? width : undefined };
  }, [imgAttrs]);

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    setOriginalSize({
      width: e.currentTarget.width,
      height: e.currentTarget.height,
    });
    setNaturalSize({
      width: e.currentTarget.naturalWidth,
      height: e.currentTarget.naturalHeight,
    });
  }

  // https://github.com/scrumpy/tiptap/issues/361#issuecomment-540299541
  function selectImage() {
    const { editor, getPos } = props;
    const pos = getPos();
    if (pos !== undefined) editor.commands.setNodeSelection(pos);
  }

  const getMaxSize = useCallback(
    throttle(() => {
      const { editor } = props;
      const { width } = getComputedStyle(editor.view.dom);
      setMaxSize((prev) => {
        return {
          ...prev,
          width: Number.parseInt(width, 10),
        };
      });
    }, IMAGE_THROTTLE_WAIT_TIME),
    [props?.editor]
  );

  function onPointerDown(e: React.PointerEvent<HTMLSpanElement>, dir: string) {
    if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) {
      return;
    }

    if (!isEditorEditable(props.editor)) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    const originalWidth = originalSize.width;
    const originalHeight = originalSize.height;
    const aspectRatio = originalWidth / originalHeight;

    let width = Number(props.node.attrs.width);
    let height = Number(props.node.attrs.height);
    const maxWidth = maxSize.width;

    if (width && !height) {
      width = width > maxWidth ? maxWidth : width;
      height = Math.round(width / aspectRatio);
    } else if (height && !width) {
      width = Math.round(height * aspectRatio);
      width = width > maxWidth ? maxWidth : width;
    } else if (!width && !height) {
      width = originalWidth > maxWidth ? maxWidth : originalWidth;
      height = Math.round(width / aspectRatio);
    } else {
      width = width > maxWidth ? maxWidth : width;
    }

    resizeSession.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      width,
      direction: dir,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setResizing(true);
  }

  const resizeToPointer = useMemo(
    () =>
      throttle((clientX: number, pointerId: number) => {
        const session = resizeSession.current;
        if (!session || session.pointerId !== pointerId || !isEditorEditable(props.editor)) {
          return;
        }

        const dx = (clientX - session.x) * (/l/.test(session.direction) ? -1 : 1);
        const width = clamp(session.width + dx, IMAGE_MIN_SIZE, maxSize.width);

        updateAttributes({
          width,
          height: null,
        });
      }, IMAGE_THROTTLE_WAIT_TIME),
    [maxSize.width, updateAttributes, props.editor]
  );

  function onPointerMove(e: React.PointerEvent<HTMLSpanElement>) {
    if (resizeSession.current?.pointerId !== e.pointerId) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    resizeToPointer(e.clientX, e.pointerId);
  }

  function finishResize(e: React.PointerEvent<HTMLSpanElement>, updateFinalPosition: boolean) {
    if (resizeSession.current?.pointerId !== e.pointerId) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (updateFinalPosition) {
      resizeToPointer(e.clientX, e.pointerId);
      resizeToPointer.flush();
    } else {
      resizeToPointer.cancel();
    }

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    resizeSession.current = null;
    setResizing(false);
    selectImage();
  }

  useEffect(() => {
    return () => {
      resizeToPointer.cancel();
    };
  }, [resizeToPointer]);

  // Turned read-only mid-drag: the handles unmount, so end the session here.
  useEffect(() => {
    if (editable || !resizeSession.current) return;

    resizeToPointer.cancel();
    resizeSession.current = null;
    setResizing(false);
  }, [editable, resizeToPointer]);

  const resizeOb: ResizeObserver = useMemo(() => {
    return new ResizeObserver(() => getMaxSize());
  }, [getMaxSize]);

  useEffect(() => {
    resizeOb.observe(props.editor.view.dom);

    return () => {
      resizeOb.disconnect();
    };
  }, [props.editor.view.dom, resizeOb]);

  return (
    <NodeViewWrapper
      as={isBlockNode ? 'div' : 'span'}
      className='image-view'
      style={{
        float: inlineFloat ? align : undefined,
        margin: inlineFloat ? (align === 'left' ? '1em 1em 1em 0' : '1em 0 1em 1em') : undefined,
        display: isInline ? 'inline' : 'block',
        textAlign: inlineFloat ? undefined : align,
        width: imgAttrs.style?.width ?? 'auto',
        ...(inlineFloat ? {} : imageMaxStyle),
      }}
    >
      <span
        data-drag-handle={editable ? '' : undefined}
        draggable={editable ? 'true' : 'false'}
        className={`image-view__body ${props?.selected ? 'image-view__body--focused' : ''} ${
          resizing ? 'image-view__body--resizing' : ''
        }`}
        style={rotatedBox ? { width: rotatedBox.width, height: rotatedBox.height } : imageMaxStyle}
      >
        <img
          alt={imgAttrs.alt}
          className='image-view__body__image block'
          height='auto'
          onClick={selectImage}
          onLoad={onImageLoad}
          src={imgAttrs.src}
          style={imgAttrs.style}
        />

        {editable && (props?.selected || resizing) && (
          <span className='image-resizer'>
            {resizeDirections?.map((direction) => {
              return (
                <span
                  className={`image-resizer__handler image-resizer__handler--${direction}`}
                  key={`image-dir-${direction}`}
                  onPointerCancel={(e) => finishResize(e, false)}
                  onPointerDown={(e) => onPointerDown(e, direction)}
                  onPointerMove={onPointerMove}
                  onPointerUp={(e) => finishResize(e, true)}
                ></span>
              );
            })}
          </span>
        )}
      </span>

      {hasCaption ? (
        <ImageCaption
          align={align}
          editable={editable}
          focusToken={captionFocusToken}
          onCommit={(value) =>
            isEditorEditable(props.editor) && updateAttributes({ caption: value })
          }
          placeholder={t('editor.image.caption.placeholder')}
          value={caption}
        />
      ) : null}
    </NodeViewWrapper>
  );
}

interface ImageCaptionProps {
  align?: string;
  editable: boolean;
  /** Bumped by the node view each time a caption is added. */
  focusToken: number;
  onCommit: (value: string) => void;
  placeholder: string;
  value: string;
}

/**
 * The caption lives in the node's `caption` attribute rather than in the
 * document, so a plain input edits it.
 *
 * The text is held locally and only written back on blur or Enter. Dispatching
 * a transaction per keystroke pulled focus back into the editor after the first
 * character and tore down any in-flight IME composition, so Chinese (and every
 * other composed script) could not be typed at all.
 *
 * `CAPTION_CLASS` is what `stopEvent` on the node view matches, which is what
 * keeps ProseMirror from turning a click here into a selection of the image —
 * with the image node selected, the next keystroke replaced it.
 */
function ImageCaption({
  align,
  editable,
  focusToken,
  onCommit,
  placeholder,
  value,
}: ImageCaptionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);

  // Follow changes made elsewhere (undo, collaboration, the toolbar toggle).
  useEffect(() => {
    setDraft(value);
  }, [value]);

  // Put the cursor after the prefilled "Figure n:" so the user types on from it.
  useEffect(() => {
    if (!focusToken || !editable) {
      return;
    }

    const input = inputRef.current;

    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    // Only react to a new token; `value` changes on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken, editable]);

  if (!editable) {
    return value ? (
      <span className={CAPTION_CLASS} style={{ textAlign: align as never }}>
        {value}
      </span>
    ) : null;
  }

  const commit = (next: string) => {
    if (next !== value) {
      onCommit(next);
    }
  };

  return (
    <input
      className={CAPTION_CLASS}
      contentEditable={false}
      onBlur={() => commit(draft)}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        // Never let the editor's keymap see these keys.
        event.stopPropagation();

        if (event.key === 'Enter') {
          event.preventDefault();
          commit(event.currentTarget.value);
          inputRef.current?.blur();
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          setDraft(value);
          inputRef.current?.blur();
        }
      }}
      onMouseDown={(event) => event.stopPropagation()}
      placeholder={placeholder}
      ref={inputRef}
      style={{ textAlign: align as never }}
      value={draft}
    />
  );
}

export default ImageView;
