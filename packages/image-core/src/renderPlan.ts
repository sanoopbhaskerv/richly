import type {
  DecodedImageSource,
  ImageOperation,
  OperationDefinition,
  RenderPlan,
  RenderStage,
  Size
} from './types';

/** Compiles immutable operations into a geometry-aware render plan. */
export function compileRenderPlan(
  source: DecodedImageSource,
  operations: readonly ImageOperation[],
  resolve: (type: string) => OperationDefinition
): RenderPlan {
  const stages: RenderStage[] = [];
  let size: Size = { width: source.info.width, height: source.info.height };

  for (const operation of operations) {
    const definition = resolve(operation.type);
    const stage = definition.createStage(operation.params);
    stages.push(stage);
    // Size reduction is kept next to stage creation so preview and export share
    // exactly the same geometry contract.
    size = definition.reduceSize(size, operation.params);
  }

  return {
    source: source.info,
    operations,
    stages,
    width: size.width,
    height: size.height
  };
}
