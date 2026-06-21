import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTests, submitTest, type TestResult, type TestSubmissionItem } from '@/services/user';
import { useAuth } from '@/context/auth-context';

const TESTS_KEY = ['tests'] as const;

// The user's self-test history, newest first.
export function useTestsQuery() {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey: TESTS_KEY,
    queryFn: getTests,
    enabled: isAuthenticated,
    staleTime: 30 * 1000,
  });
}

// Grades + stores a completed self-test, then refreshes the history.
export function useSubmitTest() {
  const qc = useQueryClient();
  return useMutation<TestResult, Error, { list: string; groupLabel: string; items: TestSubmissionItem[] }>({
    mutationFn: (body) => submitTest(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: TESTS_KEY }),
  });
}
