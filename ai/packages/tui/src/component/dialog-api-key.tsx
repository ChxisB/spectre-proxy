import { createMemo } from "solid-js"
import { useTheme } from "../context/theme"
import { useDialog } from "../ui/dialog"
import { useSync } from "../context/sync"
import { useSDK } from "../context/sdk"
import { useToast } from "../ui/toast"
import { DialogSelect } from "../ui/dialog-select"
import { DialogConfirm } from "../ui/dialog-confirm"
import { DialogAlert } from "../ui/dialog-alert"
import { DialogProvider } from "./dialog-provider"

export function DialogApiKey() {
  const dialog = useDialog()
  const { theme } = useTheme()
  const sync = useSync()

  const connected = createMemo(() => {
    const connectedIDs = sync.data.provider_next.connected
    return sync.data.provider_next.all.filter(
      (p) => connectedIDs.includes(p.id),
    )
  })

  const disconnected = createMemo(() => {
    const connectedIDs = sync.data.provider_next.connected
    return sync.data.provider_next.all.filter(
      (p) => !connectedIDs.includes(p.id),
    )
  })

  const options = createMemo(() => [
    ...connected().map((provider) => ({
      title: provider.name,
      value: provider.id,
      description: "Connected",
      category: "Connected Providers",
      gutter: () => (
        <text fg={theme.success}>✓</text>
      ),
      onSelect() {
        dialog.replace(() => (
          <ConnectedProviderActions
            providerID={provider.id}
            providerName={provider.name}
          />
        ))
      },
    })),
    ...disconnected().map((provider) => ({
      title: provider.name,
      value: provider.id,
      description: "Not connected",
      category: "Available Providers",
      onSelect() {
        dialog.replace(() => <DialogProvider />)
      },
    })),
    {
      title: "Add provider",
      value: "__add__",
      description: "Connect a new provider",
      category: "",
      onSelect() {
        dialog.replace(() => <DialogProvider />)
      },
    },
  ])

  return (
    <DialogSelect
      title="API Keys"
      options={options()}
    />
  )
}

function ConnectedProviderActions(props: {
  providerID: string
  providerName: string
}) {
  const dialog = useDialog()
  const { theme } = useTheme()
  const sdk = useSDK()
  const sync = useSync()
  const toast = useToast()

  const options = createMemo(() => [
    {
      title: "Remove API Key",
      value: "remove",
      description: `Disconnect ${props.providerName}`,
      async onSelect() {
        const confirmed = await DialogConfirm.show(
          dialog,
          "Remove API Key",
          `Are you sure you want to remove the API key for ${props.providerName}?`,
        )
        if (!confirmed) return

        const { error } = await sdk.client.auth.remove({
          providerID: props.providerID,
        })
        if (error) {
          await DialogAlert.show(dialog, "Error", "Failed to remove API key")
          return
        }
        await sdk.client.instance.dispose()
        await sync.bootstrap()
        toast.show({
          variant: "info",
          message: `Removed API key for ${props.providerName}`,
        })
        dialog.clear()
      },
    },
    {
      title: "Replace API Key",
      value: "replace",
      description: `Update the API key for ${props.providerName}`,
      onSelect() {
        dialog.replace(() => <DialogProvider />)
      },
    },
  ])

  return (
    <DialogSelect
      title={props.providerName}
      options={options()}
    />
  )
}
