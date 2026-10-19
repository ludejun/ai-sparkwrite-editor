import { useEffect } from 'react';

import { renderCommandListDefault } from '@/extensions/SlashCommand/renderCommandListDefault';
import { type Command, type CommandList } from '@/extensions/SlashCommand/types';
import { useLocale } from '@/locales';
import { useSignalCommandList } from '@/store/commandList';

interface SlashCommandListProps {
  /** Replaces the whole menu. */
  commandList?: CommandList[];
  /**
   * Host commands added at the top of the default "Insert" group (a media
   * library, templates…), keeping every built-in entry.
   */
  extraCommands?: Command[];
}

export function SlashCommandList({ commandList, extraCommands }: SlashCommandListProps) {
  const [, setSignalCommandListValue] = useSignalCommandList();
  const { t } = useLocale();

  useEffect(() => {
    if (!commandList?.length) {
      const defaultCommands = renderCommandListDefault({ t });
      if (extraCommands?.length && defaultCommands[0]) {
        defaultCommands[0].commands.unshift(...extraCommands);
      }
      setSignalCommandListValue(defaultCommands);
      return;
    }

    setSignalCommandListValue(commandList);
  }, [t, commandList, extraCommands]);

  return <></>;
}
