<!-- Context: talonagents-repo/examples | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Example: BaseAdapter Implementation Pattern

**Purpose**: Template method pattern for AI tool adapters

**Last Updated**: 2026-02-04

---

## Core Pattern

**Template Method**: BaseAdapter defines algorithm structure, subclasses implement tool-specific details

---

## BaseAdapter Structure

```typescript
export abstract class BaseAdapter {
  abstract name: string
  abstract displayName: string
  
  // Must implement
  abstract toOAC(source: string): Promise<TalonAgent>
  abstract fromOAC(agent: TalonAgent): Promise<ConversionResult>
  abstract getConfigPath(): string
  abstract getCapabilities(): ToolCapabilities
  abstract validateConversion(agent: TalonAgent): string[]
  
  // Shared utilities
  supportsFeature(feature: keyof ToolCapabilities): boolean
  warn(message: string): void
  createSuccessResult(configs, warnings): ConversionResult
  safeParseJSON(content, filename): unknown | null
  unsupportedFeatureWarning(feature, value): string
  degradedFeatureWarning(feature, from, to): string
}
```

---

## Implementation Example

```typescript
export class WindsurfAdapter extends BaseAdapter {
  name = 'windsurf'
  displayName = 'Windsurf'
  
  async toOAC(source: string): Promise<TalonAgent> {
    const config = this.safeParseJSON(source, 'config.json')
    return {
      frontmatter: {
        name: config.name,
        model: this.mapWindsurfModelToOAC(config.model),
        tools: this.parseWindsurfTools(config.tools),
        temperature: this.mapCreativityToTemperature(config.creativity)
      },
      systemPrompt: config.systemPrompt,
      contexts: []
    }
  }
  
  async fromOAC(agent: TalonAgent): Promise<ConversionResult> {
    const warnings: string[] = []
    
    // Warn on unsupported features
    if (agent.frontmatter.hooks) {
      warnings.push(this.unsupportedFeatureWarning('hooks', 'lost'))
    }
    
    const config = {
      name: agent.frontmatter.name,
      model: this.mapOACModelToWindsurf(agent.frontmatter.model),
      creativity: this.mapTemperatureToCreativity(agent.frontmatter.temperature)
    }
    
    return this.createSuccessResult([
      { fileName: '.windsurf/config.json', content: JSON.stringify(config) }
    ], warnings)
  }
  
  getCapabilities(): ToolCapabilities {
    return {
      supportsMultipleAgents: true,
      supportsHooks: false,
      supportsTemperature: true // via creativity
    }
  }
}
```

---

## Key Methods

### toOAC()
Parse tool format → TalonAgent object
- Parse source (JSON/YAML)
- Map fields
- Validate with Zod
- Return TalonAgent

### fromOAC()
Convert TalonAgent → tool format
- Validate input
- Map fields
- Detect unsupported features → warnings
- Generate config files

### getCapabilities()
Declare supported features (used for validation)

---

## Utility Usage

```typescript
// Safe parsing
const config = this.safeParseJSON(content, 'config.json')

// Feature checks
if (this.supportsFeature('supportsTemperature')) {
  config.temperature = agent.frontmatter.temperature
}

// Warnings
if (!this.supportsFeature('supportsHooks')) {
  warnings.push(this.unsupportedFeatureWarning('hooks'))
}

// Results
return this.createSuccessResult([{ fileName, content }], warnings)
```

---

## Design Principles

1. **Template Method** - Base defines structure, subs fill details
2. **Pure toOAC/fromOAC** - Deterministic conversion
3. **Capabilities First** - Declare support upfront
4. **Graceful Degradation** - Warn, don't fail
5. **Validate Early** - Check before converting

---

## Reference

**Implementation**: `packages/compatibility-layer/src/adapters/BaseAdapter.ts`

**Concrete Adapters**:
- ClaudeAdapter.ts (600 lines)
- CursorAdapter.ts (554 lines)
- WindsurfAdapter.ts (514 lines)

**Related**:
- concepts/compatibility-layer.md
- guides/compatibility-layer-development.md
- lookup/compatibility-layer-adapters.md
