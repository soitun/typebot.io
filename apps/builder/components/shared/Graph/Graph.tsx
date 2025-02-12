import { Flex, FlexProps, useEventListener } from '@chakra-ui/react'
import React, { useRef, useMemo, useEffect, useState } from 'react'
import {
  blockWidth,
  Coordinates,
  graphPositionDefaultValue,
  useGraph,
} from 'contexts/GraphContext'
import { useStepDnd } from 'contexts/GraphDndContext'
import { useTypebot } from 'contexts/TypebotContext/TypebotContext'
import { DraggableStepType, PublicTypebot, Typebot } from 'models'
import { AnswersCount } from 'services/analytics'
import { useDebounce } from 'use-debounce'
import { DraggableCore, DraggableData, DraggableEvent } from 'react-draggable'
import GraphContent from './GraphContent'
import cuid from 'cuid'
import { headerHeight } from '../TypebotHeader'
import { useUser } from 'contexts/UserContext'
import { GraphNavigation } from 'db'
import { ZoomButtons } from './ZoomButtons'

const maxScale = 1.5
const minScale = 0.1
const zoomButtonsScaleStep = 0.2

export const Graph = ({
  typebot,
  answersCounts,
  onUnlockProPlanClick,
  ...props
}: {
  typebot?: Typebot | PublicTypebot
  answersCounts?: AnswersCount[]
  onUnlockProPlanClick?: () => void
} & FlexProps) => {
  const {
    draggedStepType,
    setDraggedStepType,
    draggedStep,
    setDraggedStep,
    draggedItem,
    setDraggedItem,
  } = useStepDnd()
  const graphContainerRef = useRef<HTMLDivElement | null>(null)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const { createBlock } = useTypebot()
  const {
    setGraphPosition: setGlobalGraphPosition,
    setOpenedStepId,
    updateBlockCoordinates,
    setPreviewingEdge,
    connectingIds,
  } = useGraph()
  const [graphPosition, setGraphPosition] = useState(graphPositionDefaultValue)
  const [debouncedGraphPosition] = useDebounce(graphPosition, 200)
  const transform = useMemo(
    () =>
      `translate(${graphPosition.x}px, ${graphPosition.y}px) scale(${graphPosition.scale})`,
    [graphPosition]
  )
  const { user } = useUser()

  const [autoMoveDirection, setAutoMoveDirection] = useState<
    'top' | 'right' | 'bottom' | 'left' | undefined
  >()
  useAutoMoveBoard(autoMoveDirection, setGraphPosition)

  useEffect(() => {
    editorContainerRef.current = document.getElementById(
      'editor-container'
    ) as HTMLDivElement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!graphContainerRef.current) return
    const { top, left } = graphContainerRef.current.getBoundingClientRect()
    setGlobalGraphPosition({
      x: left + debouncedGraphPosition.x,
      y: top + debouncedGraphPosition.y,
      scale: debouncedGraphPosition.scale,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedGraphPosition])

  const handleMouseWheel = (e: WheelEvent) => {
    e.preventDefault()
    const isPinchingTrackpad = e.ctrlKey
    user?.graphNavigation === GraphNavigation.MOUSE
      ? zoom(-e.deltaY * 0.001, { x: e.clientX, y: e.clientY })
      : isPinchingTrackpad
      ? zoom(-e.deltaY * 0.01, { x: e.clientX, y: e.clientY })
      : setGraphPosition({
          ...graphPosition,
          x: graphPosition.x - e.deltaX,
          y: graphPosition.y - e.deltaY,
        })
  }

  const handleMouseUp = (e: MouseEvent) => {
    if (!typebot) return
    if (draggedItem) setDraggedItem(undefined)
    if (!draggedStep && !draggedStepType) return

    const coordinates = projectMouse(
      { x: e.clientX, y: e.clientY },
      graphPosition
    )
    const id = cuid()
    updateBlockCoordinates(id, coordinates)
    createBlock({
      id,
      ...coordinates,
      step: draggedStep ?? (draggedStepType as DraggableStepType),
      indices: { blockIndex: typebot.blocks.length, stepIndex: 0 },
    })
    setDraggedStep(undefined)
    setDraggedStepType(undefined)
  }

  const handleCaptureMouseDown = (e: MouseEvent) => {
    const isRightClick = e.button === 2
    if (isRightClick) e.stopPropagation()
  }

  const handleClick = () => {
    setOpenedStepId(undefined)
    setPreviewingEdge(undefined)
  }

  const onDrag = (_: DraggableEvent, draggableData: DraggableData) => {
    const { deltaX, deltaY } = draggableData
    setGraphPosition({
      ...graphPosition,
      x: graphPosition.x + deltaX,
      y: graphPosition.y + deltaY,
    })
  }

  const zoom = (delta = zoomButtonsScaleStep, mousePosition?: Coordinates) => {
    const { x: mouseX, y } = mousePosition ?? { x: 0, y: 0 }
    const mouseY = y - headerHeight
    let scale = graphPosition.scale + delta
    if (
      (scale >= maxScale && graphPosition.scale === maxScale) ||
      (scale <= minScale && graphPosition.scale === minScale)
    )
      return
    scale = scale >= maxScale ? maxScale : scale <= minScale ? minScale : scale

    const xs = (mouseX - graphPosition.x) / graphPosition.scale
    const ys = (mouseY - graphPosition.y) / graphPosition.scale
    setGraphPosition({
      ...graphPosition,
      x: mouseX - xs * scale,
      y: mouseY - ys * scale,
      scale,
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!connectingIds)
      return autoMoveDirection ? setAutoMoveDirection(undefined) : undefined
    if (e.clientX <= 50) return setAutoMoveDirection('left')
    if (e.clientY <= 50 + headerHeight) return setAutoMoveDirection('top')
    if (e.clientX >= window.innerWidth - 50)
      return setAutoMoveDirection('right')
    if (e.clientY >= window.innerHeight - 50)
      return setAutoMoveDirection('bottom')
    setAutoMoveDirection(undefined)
  }

  useEventListener('wheel', handleMouseWheel, graphContainerRef.current)
  useEventListener('mousedown', handleCaptureMouseDown, undefined, {
    capture: true,
  })
  useEventListener('mouseup', handleMouseUp, graphContainerRef.current)
  useEventListener('click', handleClick, editorContainerRef.current)
  useEventListener('mousemove', handleMouseMove)
  return (
    <DraggableCore onDrag={onDrag} enableUserSelectHack={false}>
      <Flex ref={graphContainerRef} position="relative" {...props}>
        <ZoomButtons
          onZoomIn={() => zoom(zoomButtonsScaleStep)}
          onZoomOut={() => zoom(-zoomButtonsScaleStep)}
        />
        <Flex
          flex="1"
          w="full"
          h="full"
          position="absolute"
          style={{
            transform,
          }}
          willChange="transform"
          transformOrigin="0px 0px 0px"
        >
          <GraphContent
            answersCounts={answersCounts}
            onUnlockProPlanClick={onUnlockProPlanClick}
          />
        </Flex>
      </Flex>
    </DraggableCore>
  )
}

const projectMouse = (
  mouseCoordinates: Coordinates,
  graphPosition: Coordinates & { scale: number }
) => {
  return {
    x:
      (mouseCoordinates.x -
        graphPosition.x -
        blockWidth / (3 / graphPosition.scale)) /
      graphPosition.scale,
    y:
      (mouseCoordinates.y -
        graphPosition.y -
        (headerHeight + 20 * graphPosition.scale)) /
      graphPosition.scale,
  }
}

const useAutoMoveBoard = (
  autoMoveDirection: 'top' | 'right' | 'bottom' | 'left' | undefined,
  setGraphPosition: React.Dispatch<
    React.SetStateAction<{
      x: number
      y: number
      scale: number
    }>
  >
) =>
  useEffect(() => {
    if (!autoMoveDirection) return
    const interval = setInterval(() => {
      setGraphPosition((prev) => ({
        ...prev,
        x:
          autoMoveDirection === 'right'
            ? prev.x - 5
            : autoMoveDirection === 'left'
            ? prev.x + 5
            : prev.x,
        y:
          autoMoveDirection === 'bottom'
            ? prev.y - 5
            : autoMoveDirection === 'top'
            ? prev.y + 5
            : prev.y,
      }))
    }, 5)

    return () => {
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMoveDirection])
