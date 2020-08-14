import { MockService } from './mock.service';

export function initMocks(mockService: MockService) {
  return () => mockService.loadMock();
}
