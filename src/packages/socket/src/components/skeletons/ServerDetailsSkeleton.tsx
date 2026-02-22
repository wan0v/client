import { Flex } from "@radix-ui/themes";

import { ChannelSkeleton } from "./ChannelSkeleton";
import { SkeletonBase } from "./SkeletonBase";

export const ServerDetailsSkeleton = () => {
  return (
    <Flex direction="column" align="center" justify="between" height="100%" width="100%">
      <Flex direction="column" gap="4" align="center" width="100%">
        {/* Server header skeleton */}
        <Flex direction="column" gap="2" align="center" width="100%">
          <SkeletonBase width="120px" height="24px" borderRadius="var(--radius-4)" />
          <SkeletonBase width="80px" height="16px" borderRadius="var(--radius-2)" />
        </Flex>

        {/* Channel list skeleton */}
        <ChannelSkeleton />
      </Flex>
    </Flex>
  );
};
